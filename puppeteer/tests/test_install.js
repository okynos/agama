import fs from "fs";
import path from "path";

import puppeteer from "puppeteer-core";
import { expect } from "chai";

// This is an example file for running Agama integration tests using Puppeteer.
//
// If the test fails it saves the page screenshot and the HTML page dump to
// ./log/ subdirectory.
// For more details about customization see the README.md file.

// helper function for converting String to Boolean
function booleanEnv(name, default_value) {
  const env = process.env[name];
  if (env === undefined) {
    return default_value;
  }
  switch (env.toLowerCase()) {
    case "0":
    case "false":
    case "off":
    case "disabled":
    case "no":
      return false;
    case "1":
    case "true":
    case "on":
    case "enabled":
    case "yes":
      return true;
    default:
      return default_value;
  }
}

// helper function for configuring the browser
function browserSettings(name) {
  switch (name.toLowerCase()) {
    case "firefox":
      return {
        product: "firefox",
        executablePath: "/usr/bin/firefox",
      };
    case "chrome":
      return {
        product: "chrome",
        executablePath: "/usr/bin/google-chrome-stable",
      };
    case "chromium":
      return {
        product: "chrome",
        executablePath: "/usr/bin/chromium",
      };
    default:
      throw new Error(`Unsupported browser type: ${name}`);
  }
}

const agamaServer = process.env.AGAMA_SERVER || "http://localhost";
const agamaPassword = process.env.AGAMA_PASSWORD || "linux";
const agamaBrowser = process.env.AGAMA_BROWSER || "firefox";
const slowMo = parseInt(process.env.AGAMA_SLOWMO || "0");
const headless = booleanEnv("AGAMA_HEADLESS", true);

describe("Agama installation test", function () {
  // mocha timeout
  this.timeout(20000);

  let page;
  let browser;
  let min_to_ms_const = 60 * 1000;

  before(async function () {
    browser = await puppeteer.launch({
      // "webDriverBiDi" does not work with old FireFox, comment it out if needed
      protocol: "webDriverBiDi",
      headless,
      ignoreHTTPSErrors: true,
      timeout: 30000,
      slowMo,
      defaultViewport: {
        width: 1280,
        height: 768
      },
      ...browserSettings(agamaBrowser)
    });
    page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(agamaServer, { timeout: 60000, waitUntil: "domcontentloaded" });
  });

  after(async function () {
    await page.close();
    await browser.close();
  })

  // automatically take a screenshot and dump the page content for failed tests
  afterEach(async function () {
    if (this.currentTest.state === "failed") {
      // directory for storing the data
      const dir = "log";
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);

      // base file name for the dumps
      const name = path.join(dir, this.currentTest.title.replace(/[^a-zA-Z0-9]/g, "_"));
      await page.screenshot({ path: name + ".png" });
      const html = await page.content();
      fs.writeFileSync(name + ".html", html);
    }
  });

  it("Should have Agama page title", async function () {
    expect(await page.title()).to.eql("Agama");
  });

  it("Allows logging in", async function () {
    // await page.waitForSelector("input#password");
    await page.type("input#password", agamaPassword);
    await page.click("button[type='submit']");
  });

  it("Should optionally display the product selection dialog", async function () {
    let waiting_time = 5; // Unit in minutes
    let timeout = waiting_time * min_to_ms_const;
    this.timeout(timeout);
    // Either the main page is displayed (with the storage link) or there is
    // the product selection page.
    let productSelectionDisplayed = await Promise.any([
      page.waitForSelector("a[href='#/storage']")
        .then(s => {s.dispose(); return false}),
      page.waitForSelector("button[form='productSelectionForm']")
        .then(s => {s.dispose(); return true})
    ]);

    if (productSelectionDisplayed) {
      await page.locator("::-p-text('openSUSE Tumbleweed')").click();
      await page.locator("button[form='productSelectionForm']")
        // wait until the button is enabled
        .setWaitForEnabled(true)
        .click();
      // refreshing the repositories might take long time
      await page.locator("h3::-p-text('Overview')").setTimeout(timeout).wait();
    } else {
      // no product selection displayed, mark the test as skipped
      this.skip();
    }
  });

  it("Should display overview card", async function () {
    await page.waitForSelector("h3::-p-text('Overview')");
  });

  it("Should allow setting the root password", async function () {
    await page.locator("a[href='#/users']")
      .click();

    let button = await Promise.any([
      page.waitForSelector("button::-p-text(Set a password)"),
      page.waitForSelector("button#actions-for-root-password")
    ]);

    await button.click();
    const id = await button.evaluate(x => x.id);
    // drop the handler to avoid memory leaks
    button.dispose();

    // if the menu button was clicked we need to additionally press the "Change" menu item
    if (id === "actions-for-root-password") {
      await page.locator("button[role='menuitem']::-p-text('Change')").click();
    }

    const newPassword = "test";
    await page.type("input#password", newPassword);
    await page.type("input#passwordConfirmation", newPassword);

    await page.locator("button::-p-text(Confirm)").click();
  });

  // Going to overview page to run installation
  it("Should be ready for installation", async function (){
    await page.click("a[href='#/overview']");
    await page.locator("h3::-p-text('Overview')").wait();

    await page.locator("button::-p-text('Install')")
      .setWaitForEnabled(true)
      .click();

    //let ready_msg = await page.locator("h4::-p-text('Ready for installation')").setTimeout(60000).wait();
    //expect(ready_msg).to.eql("Ready for installation");
    //ready_msg.dispose();
  });

  // Locate and click the Continue button inside the confirm install popup
  it("Should confirm installation", async function (){
    await page.locator("button::-p-text('Continue')")
      .setWaitForEnabled(true)
      .click();
  });

  // Check if installation procedure is going ok
  it("Should install the system", async function (){
    let progress_title = await page.locator("#progress-title")
      .map(header => header.innerText)
      .wait();
    expect(progress_title).to.eql("Installing the system, please wait ...")
  });

  // Wait and check installation completed
  it("Should show installation result", async function(){
    let waiting_time = 40; // Unit in minutes
    let timeout = waiting_time * min_to_ms_const;
    this.timeout(timeout);
    let congrats_header = await page.locator("h2::-p-text('Congratulations!')")
    .setTimeout(timeout)
    .map(header => header.innerText)
    .wait();

    expect(congrats_header).to.eql("Congratulations!");
    await page.locator("button::-p-text('Reboot')")
      .setWaitForEnabled(true)
      .click()
  });

});
