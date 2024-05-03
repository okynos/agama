/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// @ts-check
// cspell:ignore dasda ddgdcbibhd

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DeviceSelectionDialog } from "~/components/storage";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("./DeviceSelectionDialog").DeviceSelectionDialogProps} DeviceSelectionDialogProps
 */

/** @type {StorageDevice} */
const vda = {
  sid: 59,
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  description: "",
  size: 1024,
  systems: ["Windows 11", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

/** @type {StorageDevice} */
const vda1 = {
  sid: 60,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/vda1",
  description: "",
  size: 512,
  start: 123,
  encrypted: false,
  recoverableSize: 128,
  systems: [],
  udevIds: [],
  udevPaths: [],
  isEFI: false
};

/** @type {StorageDevice} */
const vda2 = {
  sid: 61,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/vda2",
  description: "",
  size: 256,
  start: 1789,
  encrypted: false,
  recoverableSize: 0,
  systems: [],
  udevIds: [],
  udevPaths: [],
  isEFI: false
};

vda.partitionTable = {
  type: "gpt",
  partitions: [vda1, vda2],
  unpartitionedSize: 0,
  unusedSlots: []
};

/** @type {StorageDevice} */
const vdb = {
  sid: 62,
  isDrive: true,
  type: "disk",
  vendor: "Disk",
  model: "",
  driver: [],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/vdb",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems: [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const vdc = {
  sid: 63,
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/vdc",
  description: "",
  size: 2048,
  recoverableSize: 0,
  systems: [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

/** @type {StorageDevice} */
const md0 = {
  sid: 63,
  isDrive: false,
  type: "md",
  level: "raid0",
  uuid: "12345:abcde",
  devices: [vdb],
  active: true,
  name: "/dev/md0",
  description: "",
  size: 2048,
  systems: [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const raid = {
  sid: 64,
  isDrive: true,
  type: "raid",
  devices: [vda, vdb],
  vendor: "Dell",
  model: "Dell BOSS-N1 Modular",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: true,
  sdCard: false,
  active: true,
  name: "/dev/mapper/isw_ddgdcbibhd_244",
  description: "",
  size: 2048,
  systems: [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const multipath = {
  sid: 65,
  isDrive: true,
  type: "multipath",
  wires: [vda, vdb],
  vendor: "",
  model: "",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/mapper/36005076305ffc73a00000000000013b4",
  description: "",
  size: 2048,
  systems: [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const dasd = {
  sid: 66,
  isDrive: true,
  type: "dasd",
  vendor: "IBM",
  model: "IBM",
  driver: [],
  bus: "",
  busId: "0.0.0150",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/dasda",
  description: "",
  size: 2048,
  systems: [],
  udevIds: [],
  udevPaths: []
};

/** @type {DeviceSelectionDialogProps} */
let props;

const expectSelector = (selector) => {
  const option = (name) => {
    const row = within(selector).getByRole("row", { name });
    return within(row).queryByRole("radio") || within(row).queryByRole("checkbox");
  };

  const matchers = (modifier = (obj) => obj) => {
    return {
      toHaveCheckedOption: (name) => {
        modifier(expect(option(name))).toBeChecked();
      },
      toBeVisible: () => {
        // Jsdom does not report correct styles, see https://github.com/jsdom/jsdom/issues/2986.
        // expect(selector).not.toBeVisible();
        modifier(expect(selector.parentNode)).toHaveAttribute("aria-expanded", "true");
      }
    };
  };

  return { ...matchers(), not: { ...matchers((obj) => obj.not) } };
};

const clickSelectorOption = async (user, selector, name) => {
  const row = within(selector).getByRole("row", { name });
  const option = within(row).queryByRole("radio") || within(row).queryByRole("checkbox");
  await user.click(option);
};

describe("DeviceSelectionDialog", () => {
  beforeEach(() => {
    props = {
      isOpen: true,
      target: "DISK",
      targetDevice: undefined,
      targetPVDevices: [],
      devices: [vda, vdb, vdc, md0, raid, multipath, dasd],
      onCancel: jest.fn(),
      onAccept: jest.fn()
    };
  });

  it("offers an option to select a disk as target device for installation", () => {
    plainRender(<DeviceSelectionDialog {...props} />);
    screen.getByRole("radio", { name: "Select a disk" });
  });

  it("offers an option to create a new LVM volume group as target device for installation", () => {
    plainRender(<DeviceSelectionDialog {...props} />);
    screen.getByRole("radio", { name: "Create an LVM Volume Group" });
  });

  describe("if the target is a disk", () => {
    beforeEach(() => {
      props.target = "DISK";
      props.targetDevice = vda;
    });

    it("selects the disk option by default", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).toBeChecked();
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();
    });

    it("shows the disk selector", async () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expect(diskSelector).toBeVisible();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(lvmSelector).not.toBeVisible();
    });

    it("shows the target disk as selected", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const selector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(selector).toHaveCheckedOption(/\/dev\/vda/);
      expectSelector(selector).not.toHaveCheckedOption(/\/dev\/vdb/);
      expectSelector(selector).not.toHaveCheckedOption(/\/dev\/vdc/);
    });

    it("allows to switch to new LVM", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();

      await user.click(lvmOption);

      expect(lvmOption).toBeChecked();
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expect(lvmSelector).toBeVisible();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(diskSelector).not.toBeVisible();
    });
  });

  describe("if the target is a new LVM volume group", () => {
    beforeEach(() => {
      props.target = "NEW_LVM_VG";
      props.targetPVDevices = [vda, vdc];
    });

    it("selects the LVM option by default", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).toBeChecked();
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();
    });

    it("shows the selector for LVM candidate devices", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expect(lvmSelector).toBeVisible();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expectSelector(diskSelector).not.toBeVisible();
    });

    it("shows the current candidate devices as selected", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const selector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(selector).toHaveCheckedOption(/\/dev\/vda/);
      expectSelector(selector).not.toHaveCheckedOption(/\/dev\/vdb/);
      expectSelector(selector).toHaveCheckedOption(/\/dev\/vdc/);
    });

    it("allows to switch to disk", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);
      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      expect(diskOption).not.toBeChecked();

      await user.click(diskOption);

      expect(diskOption).toBeChecked();
      const diskSelector = screen.getByRole("grid", { name: /selector for target disk/i });
      expect(diskSelector).toBeVisible();
      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      expect(lvmOption).not.toBeChecked();
      const lvmSelector = screen.getByRole("grid", { name: /selector for new lvm/i });
      expectSelector(lvmSelector).not.toBeVisible();
    });
  });

  it("does not call onAccept on cancel", async () => {
    const { user } = plainRender(<DeviceSelectionDialog {...props} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await user.click(cancel);

    expect(props.onAccept).not.toHaveBeenCalled();
  });

  describe("if the option to select a disk as target device is selected", () => {
    beforeEach(() => {
      props.target = "NEW_LVM_VG";
      props.targetDevice = vda;
    });

    it("calls onAccept with the selected target and disk on accept", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);

      const diskOption = screen.getByRole("radio", { name: /select a disk/i });
      await user.click(diskOption);

      const selector = screen.getByRole("grid", { name: /selector for target disk/i });
      await clickSelectorOption(user, selector, /\/dev\/vdb/);

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith({
        target: "DISK",
        targetDevice: vdb,
        targetPVDevices: []
      });
    });
  });

  describe("if the option to create a new LVM volume group is selected", () => {
    beforeEach(() => {
      props.target = "DISK";
      props.targetDevice = vdb;
    });

    it("calls onAccept with the selected target and the candidate devices on accept", async () => {
      const { user } = plainRender(<DeviceSelectionDialog {...props} />);

      const lvmOption = screen.getByRole("radio", { name: /create an lvm/i });
      await user.click(lvmOption);

      const selector = screen.getByRole("grid", { name: /selector for new lvm/i });
      await clickSelectorOption(user, selector, /\/dev\/vda/);
      await clickSelectorOption(user, selector, /\/dev\/vdb/);

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith({
        target: "NEW_LVM_VG",
        targetDevice: vdb,
        targetPVDevices: [vda, vdb]
      });
    });
  });

  describe("content", () => {
    const row = (name) => {
      const selector = screen.getByRole("grid", { name: /selector for target disk/i });
      return within(selector).getByRole("row", { name });
    };

    it("renders the device model", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      within(row(/\/dev\/vda/)).getByText("Micron 1100 SATA");
    });

    describe("when there is a SDCard", () => {
      it("renders 'SD Card'", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        within(row(/\/dev\/vda/)).getByText("SD Card");
      });
    });

    describe("when there is a software RAID", () => {
      it("renders its level", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        within(row(/\/dev\/md0/)).getByText("Software RAID0");
      });

      it("renders its members", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        const mdRow = row(/\/dev\/md0/);
        within(mdRow).getByText(/Members/);
        within(mdRow).getByText(/vdb/);
      });
    });

    describe("when device is RAID", () => {
      it("renders its devices", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        const raidRow = row(/\/dev\/mapper\/isw_ddgdcbibhd_244/);
        within(raidRow).getByText(/Devices/);
        within(raidRow).getByText(/vda/);
        within(raidRow).getByText(/vdb/);
      });
    });

    describe("when device is a multipath", () => {
      it("renders 'Multipath'", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        within(row(/\/dev\/mapper\/36005076305ffc73a00000000000013b4/)).getByText("Multipath");
      });

      it("renders its wires", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        const multipathRow = row(/\/dev\/mapper\/36005076305ffc73a00000000000013b4/);
        within(multipathRow).getByText(/Wires/);
        within(multipathRow).getByText(/vda/);
        within(multipathRow).getByText(/vdb/);
      });
    });

    describe("when device is DASD", () => {
      it("renders its bus id", () => {
        plainRender(<DeviceSelectionDialog {...props} />);
        within(row(/\/dev\/dasda/)).getByText("DASD 0.0.0150");
      });
    });

    it("renders the partition table info", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      within(row(/\/dev\/vda/)).getByText("GPT with 2 partitions");
    });

    it("renders systems info", () => {
      plainRender(<DeviceSelectionDialog {...props} />);
      const vdaRow = row(/\/dev\/vda/);
      within(vdaRow).getByText("Windows 11");
      within(vdaRow).getByText("openSUSE Leap 15.2");
    });
  });
});
