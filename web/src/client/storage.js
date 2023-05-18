/*
 * Copyright (c) [2022-2023] SUSE LLC
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
// cspell:ignore ptable

import DBusClient from "./dbus";
import { WithIssues, WithStatus, WithProgress } from "./mixins";
import { hex } from "~/utils";

const STORAGE_IFACE = "org.opensuse.Agama.Storage1";
const PROPOSAL_CALCULATOR_IFACE = "org.opensuse.Agama.Storage1.Proposal.Calculator";
const ISCSI_NODE_IFACE = "org.opensuse.Agama.Storage1.ISCSI.Node";
const ISCSI_NODES_NAMESPACE = "/org/opensuse/Agama/Storage1/iscsi_nodes";
const ISCSI_INITIATOR_IFACE = "org.opensuse.Agama.Storage1.ISCSI.Initiator";
const DASD_DEVICE_IFACE = "org.opensuse.Agama.Storage1.DASD.Device";
const DASD_DEVICES_NAMESPACE = "/org/opensuse/Agama/Storage1/dasds";
const DASD_MANAGER_IFACE = "org.opensuse.Agama.Storage1.DASD.Manager";
const DASD_STATUS_IFACE = "org.opensuse.Agama.Storage1.DASD.Format";
const PROPOSAL_IFACE = "org.opensuse.Agama.Storage1.Proposal";
const STORAGE_OBJECT = "/org/opensuse/Agama/Storage1";
const STORAGE_JOB_IFACE = "org.opensuse.Agama.Storage1.Job";
const STORAGE_JOBS_NAMESPACE = "/org/opensuse/Agama/Storage1/jobs";
const STORAGE_SYSTEM_NAMESPACE = "/org/opensuse/Agama/Storage1/system";

/**
 * Removes properties with undefined value
 *
 * @example
 * removeUndefinedCockpitProperties({
 *  property1: { t: "s", v: "foo" },
 *  property2: { t: b, v: false },
 *  property3: { t: "s", v: undefined }
 * });
 * //returns { property1: { t: "s", v: "foo" }, property2: { t: "b", v: false } }
 *
 * @param {object} cockpitObject
 * @returns {object}
 */
const removeUndefinedCockpitProperties = (cockpitObject) => {
  const filtered = Object.entries(cockpitObject).filter(([, { v }]) => v !== undefined);
  return Object.fromEntries(filtered);
};

/**
 * Class providing an API for managing a devices tree through D-Bus
 */
class DevicesManager {
  /**
   * @param {DBusClient} client
   * @param {string} rootPath - Root path of the devices tree
   */
  constructor(client, rootPath) {
    this.client = client;
    this.rootPath = rootPath;
  }

  /**
   * Gets all the exported devices
   *
   * @returns {Promise<StorageDevice[]>}
   *
   * @typedef {object} StorageDevice
   * @property {string} sid - Internal id that is used as D-Bus object basename
   * @property {string} type - Type of device ("disk", "raid", "multipath", "dasd", "md")
   * @property {string} [vendor]
   * @property {string} [model]
   * @property {string[]} [driver]
   * @property {string} [bus]
   * @property {string} [transport]
   * @property {boolean} [sdCard]
   * @property {boolean} [dellBOOS]
   * @property {string[]} [devices] - RAID devices (only for "raid" type)
   * @property {string} [level] - MD RAID level (only for "md" type)
   * @property {string} [uuid]
   * @property {string[]} [members] - Member devices for a MD RAID (only for "md" type)
   * @property {boolean} [active]
   * @property {string} [name] - Block device name
   * @property {number} [size]
   * @property {string[]} [systems] - Name of the installed systems
   * @property {string[]} [udevIds]
   * @property {string[]} [udevPaths]
   * @property {PartitionTableData} [partitionTable]
   *
   * @typedef {object} PartitionTableData
   * @property {string} type
   */
  async getDevices() {
    const buildDevice = (path, dbusDevice) => {
      const addDriveProperties = (device, dbusProperties) => {
        device.type = dbusProperties.Type.v;
        device.vendor = dbusProperties.Vendor.v;
        device.model = dbusProperties.Model.v;
        device.driver = dbusProperties.Driver.v;
        device.bus = dbusProperties.Bus.v;
        device.transport = dbusProperties.Transport.v;
        device.sdCard = dbusProperties.Info.v.SDCard.v;
        device.dellBOSS = dbusProperties.Info.v.DellBOSS.v;
      };

      const addRAIDProperties = (device, raidProperties) => {
        device.devices = raidProperties.Devices.v;
      };

      const addMDProperties = (device, mdProperties) => {
        device.type = "md";
        device.level = mdProperties.Level.v;
        device.uuid = mdProperties.UUID.v;
        device.members = mdProperties.Members.v;
      };

      const addBlockProperties = (device, blockProperties) => {
        device.active = blockProperties.Active.v;
        device.name = blockProperties.Name.v;
        device.size = blockProperties.Size.v;
        device.systems = blockProperties.Systems.v;
        device.udevIds = blockProperties.UdevIds.v;
        device.udevPaths = blockProperties.UdevPaths.v;
      };

      const addPtableProperties = (device, ptableProperties) => {
        device.partitionTable = { type: ptableProperties.Type.v };
      };

      const device = {
        sid: path.split("/").pop(),
        type: ""
      };

      const driveProperties = dbusDevice["org.opensuse.Agama.Storage1.Drive"];
      if (driveProperties !== undefined) addDriveProperties(device, driveProperties);

      const raidProperties = dbusDevice["org.opensuse.Agama.Storage1.RAID"];
      if (raidProperties !== undefined) addRAIDProperties(device, raidProperties);

      const mdProperties = dbusDevice["org.opensuse.Agama.Storage1.MD"];
      if (mdProperties !== undefined) addMDProperties(device, mdProperties);

      const blockProperties = dbusDevice["org.opensuse.Agama.Storage1.Block"];
      if (blockProperties !== undefined) addBlockProperties(device, blockProperties);

      const ptableProperties = dbusDevice["org.opensuse.Agama.Storage1.PartitionTable"];
      if (ptableProperties !== undefined) addPtableProperties(device, ptableProperties);

      return device;
    };

    const managedObjects = await this.client.call(
      STORAGE_OBJECT,
      "org.freedesktop.DBus.ObjectManager",
      "GetManagedObjects",
      null
    );

    const dbusObjects = managedObjects.shift();
    const systemPaths = Object.keys(dbusObjects).filter(k => k.startsWith(this.rootPath));

    return systemPaths.map(p => buildDevice(p, dbusObjects[p]));
  }
}

/**
 * Class providing an API for managing the storage proposal through D-Bus
 */
class ProposalManager {
  /**
   * @param {DBusClient} client
   * @param {DevicesManager} system
   */
  constructor(client, system) {
    this.client = client;
    this.system = system;
    this.proxies = {
      proposalCalculator: this.client.proxy(PROPOSAL_CALCULATOR_IFACE, STORAGE_OBJECT)
    };
  }

  /**
   * @typedef {object} Volume
   * @property {string|undefined} [mountPoint]
   * @property {string|undefined} [deviceType]
   * @property {boolean|undefined} [optional]
   * @property {boolean|undefined} [encrypted]
   * @property {boolean|undefined} [fixedSizeLimits]
   * @property {boolean|undefined} [adaptiveSizes]
   * @property {number|undefined} [minSize]
   * @property {number|undefined} [maxSize]
   * @property {string[]} [fsTypes]
   * @property {string|undefined} [fsType]
   * @property {boolean|undefined} [snapshots]
   * @property {boolean|undefined} [snapshotsConfigurable]
   * @property {boolean|undefined} [snapshotsAffectSizes]
   * @property {string[]} [sizeRelevantVolumes]
   *
   * @typedef {object} Action
   * @property {string} text
   * @property {boolean} subvol
   * @property {boolean} delete
   *
   * @typedef {object} Result
   * @property {string[]} candidateDevices
   * @property {boolean} lvm
   * @property {string} encryptionPassword
   * @property {Volume[]} volumes
   * @property {Action[]} actions
   */

  /**
   * Gets data associated to the proposal
   *
   * @returns {Promise<ProposalData>}
   *
   * @typedef {object} ProposalData
   * @property {StorageDevice[]} availableDevices
   * @property {Volume[]} volumeTemplates
   * @property {Result|undefined} result
   */
  async getData() {
    const availableDevices = await this.getAvailableDevices();
    const volumeTemplates = await this.getVolumeTemplates();
    const result = await this.getResult();

    return { availableDevices, volumeTemplates, result };
  }

  /**
   * Gets the list of available devices
   *
   * @returns {Promise<StorageDevice[]>}
   */
  async getAvailableDevices() {
    const findDevice = (devices, path) => {
      const sid = path.split("/").pop();
      const device = devices.find(d => d.sid === sid);

      if (device === undefined) console.log("D-Bus object not found: ", path);

      return device;
    };

    const systemDevices = await this.system.getDevices();

    const proxy = await this.proxies.proposalCalculator;
    return proxy.AvailableDevices.map(path => findDevice(systemDevices, path)).filter(d => d);
  }

  /**
   * Gets the list of volume templates for the selected product
   *
   * @returns {Promise<Volume[]>}
   */
  async getVolumeTemplates() {
    const proxy = await this.proxies.proposalCalculator;
    return proxy.VolumeTemplates.map(this.buildVolume);
  }

  /**
   * Gets the values of the current proposal
   *
   * @return {Promise<Result|undefined>}
  */
  async getResult() {
    const proxy = await this.proposalProxy();

    if (!proxy) return undefined;

    const buildResult = (proxy) => {
      const buildAction = dbusAction => {
        return {
          text: dbusAction.Text.v,
          subvol: dbusAction.Subvol.v,
          delete: dbusAction.Delete.v
        };
      };

      return {
        candidateDevices: proxy.CandidateDevices,
        lvm: proxy.LVM,
        encryptionPassword: proxy.EncryptionPassword,
        volumes: proxy.Volumes.map(this.buildVolume),
        actions: proxy.Actions.map(buildAction)
      };
    };

    return buildResult(proxy);
  }

  /**
   * Calculates a new proposal
   *
   * @param {Settings} settings
   *
   * @typedef {object} Settings
   * @property {string[]} [candidateDevices] - Devices to use for the proposal
   * @property {string} [encryptionPassword] - Password for encrypting devices
   * @property {boolean} [lvm] - Whether to calculate the proposal with LVM volumes
   * @property {Volume[]} [volumes] - Volumes to create
   *
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async calculate({ candidateDevices, encryptionPassword, lvm, volumes }) {
    const dbusVolume = (volume) => {
      return removeUndefinedCockpitProperties({
        MountPoint: { t: "s", v: volume.mountPoint },
        Encrypted: { t: "b", v: volume.encrypted },
        FsType: { t: "s", v: volume.fsType },
        MinSize: { t: "x", v: volume.minSize },
        MaxSize: { t: "x", v: volume.maxSize },
        FixedSizeLimits: { t: "b", v: volume.fixedSizeLimits },
        Snapshots: { t: "b", v: volume.snapshots }
      });
    };

    const settings = removeUndefinedCockpitProperties({
      CandidateDevices: { t: "as", v: candidateDevices },
      EncryptionPassword: { t: "s", v: encryptionPassword },
      LVM: { t: "b", v: lvm },
      Volumes: { t: "aa{sv}", v: volumes?.map(dbusVolume) }
    });

    const proxy = await this.proxies.proposalCalculator;
    return proxy.Calculate(settings);
  }

  /**
   * @private
   * Builds a volume from the D-Bus data
   *
   * @param {DBusVolume} dbusVolume
   *
   * @typedef {Object} DBusVolume
   * @property {CockpitString} [MountPoint]
   * @property {CockpitString} [DeviceType]
   * @property {CockpitBoolean} [Optional]
   * @property {CockpitBoolean} [Encrypted]
   * @property {CockpitBoolean} [FixedSizeLimits]
   * @property {CockpitBoolean} [AdaptiveSizes]
   * @property {CockpitNumber} [MinSize]
   * @property {CockpitNumber} [MaxSize]
   * @property {CockpitAString} [FsTypes]
   * @property {CockpitString} [FsType]
   * @property {CockpitBoolean} [Snapshots]
   * @property {CockpitBoolean} [SnapshotsConfigurable]
   * @property {CockpitBoolean} [SnapshotsAffectSizes]
   * @property {CockpitAString} [SizeRelevantVolumes]
   *
   * @typedef {Object} CockpitString
   * @property {string} t - variant type
   * @property {string} v - value
   *
   * @typedef {Object} CockpitBoolean
   * @property {string} t - variant type
   * @property {boolean} v - value
   *
   * @typedef {Object} CockpitNumber
   * @property {string} t - variant type
   * @property {Number} v - value
   *
   * @typedef {Object} CockpitAString
   * @property {string} t - variant type
   * @property {string[]} v - value
   *
   * @returns {Volume}
   */
  buildVolume(dbusVolume) {
    const buildList = (value) => {
      if (value === undefined) return [];

      return value.map(val => val.v);
    };

    return {
      mountPoint: dbusVolume.MountPoint?.v,
      deviceType: dbusVolume.DeviceType?.v,
      optional: dbusVolume.Optional?.v,
      encrypted: dbusVolume.Encrypted?.v,
      fixedSizeLimits: dbusVolume.FixedSizeLimits?.v,
      adaptiveSizes: dbusVolume.AdaptiveSizes?.v,
      minSize: dbusVolume.MinSize?.v,
      maxSize: dbusVolume.MaxSize?.v,
      fsTypes: buildList(dbusVolume.FsTypes?.v),
      fsType: dbusVolume.FsType?.v,
      snapshots: dbusVolume.Snapshots?.v,
      snapshotsConfigurable: dbusVolume.SnapshotsConfigurable?.v,
      snapshotsAffectSizes: dbusVolume.SnapshotsAffectSizes?.v,
      sizeRelevantVolumes: buildList(dbusVolume.SizeRelevantVolumes?.v)
    };
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.Proposal iface
   *
   * @note The proposal object implementing this iface is dynamically exported.
   *
   * @returns {Promise<object|null>} null if the proposal object is not exported yet
   */
  async proposalProxy() {
    try {
      return await this.client.proxy(PROPOSAL_IFACE);
    } catch {
      return null;
    }
  }
}

/**
 * Class providing an API for managing Direct Access Storage Devices (DASDs)
 */
class DASDManager {
  /**
   * @param {string} service - D-Bus service name
   * @param {string} address - D-Bus address
   */
  constructor(service, address) {
    this.service = service;
    this.address = address;
    this.proxies = {};
  }

  /**
   * @return {DBusClient} client
   */
  client() {
    // return this.assigned_client;
    if (!this._client) {
      this._client = new DBusClient(this.service, this.address);
    }

    return this._client;
  }

  // FIXME: use info from ObjectManager instead.
  //   https://github.com/openSUSE/Agama/pull/501#discussion_r1147707515
  async isSupported() {
    const proxy = await this.managerProxy();

    return proxy !== undefined;
  }

  /**
   * Build a job
   *
   * @returns {StorageJob}
   *
   * @typedef {object} StorageJob
   * @property {string} path
   * @property {boolean} running
   * @property {number} exitCode
   */
  buildJob(job) {
    return {
      path: job.path,
      running: job.Running,
      exitCode: job.ExitCode
    };
  }

  /**
   * Triggers a DASD probing
   */
  async probe() {
    const proxy = await this.managerProxy();
    await proxy?.Probe();
  }

  /**
   * Gets the list of DASD devices
   *
   * @returns {Promise<DASDDevice[]>}
   */
  async getDevices() {
    // FIXME: should we do the probing here?
    await this.probe();
    const devices = await this.devicesProxy();
    return Object.values(devices).map(this.buildDevice);
  }

  /**
   * Requests the format action for given devices
   *
   * @param {DASDDevice[]} devices
   */
  async format(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Format(devicesPath);
  }

  /**
   * Set DIAG for given devices
   *
   * @param {DASDDevice[]} devices
   * @param {boolean} value
   */
  async setDIAG(devices, value) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.SetDiag(devicesPath, value);
  }

  /**
   * Enables given DASD devices
   *
   * @param {DASDDevice[]} devices
   */
  async enableDevices(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Enable(devicesPath);
  }

  /**
   * Disables given DASD devices
   *
   * @param {DASDDevice[]} devices
   */
  async disableDevices(devices) {
    const proxy = await this.managerProxy();
    const devicesPath = devices.map(d => this.devicePath(d));
    proxy.Disable(devicesPath);
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.Job iface
   *
   * @note The jobs are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async jobsProxy() {
    if (!this.proxies.jobs)
      this.proxies.jobs = await this.client().proxies(STORAGE_JOB_IFACE, STORAGE_JOBS_NAMESPACE);

    return this.proxies.jobs;
  }

  async getJobs() {
    const proxy = await this.jobsProxy();
    return Object.values(proxy).filter(p => p.Running)
      .map(this.buildJob);
  }

  async onJobAdded(handler) {
    const proxy = await this.jobsProxy();
    proxy.addEventListener("added", (_, proxy) => handler(this.buildJob(proxy)));
  }

  async onJobChanged(handler) {
    const proxy = await this.jobsProxy();
    proxy.addEventListener("changed", (_, proxy) => handler(this.buildJob(proxy)));
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.Job iface
   *
   * @note The jobs are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async formatProxy(jobPath) {
    const proxy = await this.client().proxy(DASD_STATUS_IFACE, jobPath);
    return proxy;
  }

  async onFormatProgress(jobPath, handler) {
    const proxy = await this.formatProxy(jobPath);
    proxy.addEventListener("changed", (_, proxy) => {
      handler(proxy.Summary);
    });
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.DASD.Device iface
   *
   * @note The DASD devices are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async devicesProxy() {
    if (!this.proxies.devices)
      this.proxies.devices = await this.client().proxies(DASD_DEVICE_IFACE, DASD_DEVICES_NAMESPACE);

    return this.proxies.devices;
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.DASD.Manager iface
   *
   * @returns {Promise<object>}
   */
  async managerProxy() {
    if (!this.proxies.dasdManager)
      this.proxies.dasdManager = await this.client().proxy(DASD_MANAGER_IFACE, STORAGE_OBJECT);

    return this.proxies.dasdManager;
  }

  async deviceEventListener(signal, handler) {
    const proxy = await this.devicesProxy();
    const action = (_, proxy) => handler(this.buildDevice(proxy));

    proxy.addEventListener(signal, action);
    return () => proxy.removeEventListener(signal, action);
  }

  /**
   * Build a list of DASD devices
   *
   * @returns {DASDDevice}
   *
   * @typedef {object} DASDDevice
   * @property {string} id
   * @property {number} hexId
   * @property {string} accessType
   * @property {string} channelId
   * @property {boolean} diag
   * @property {boolean} enabled
   * @property {boolean} formatted
   * @property {string} name
   * @property {string} partitionInfo
   * @property {string} status
   * @property {string} type
   */
  buildDevice(device) {
    const id = device.path.split("/").slice(-1)[0];
    const enabled = device.Enabled;

    return {
      id,
      accessType: enabled ? device.AccessType : "offline",
      channelId: device.Id,
      diag: device.Diag,
      enabled,
      formatted: device.Formatted,
      hexId: hex(device.Id),
      name: device.DeviceName,
      partitionInfo: enabled ? device.PartitionInfo : "",
      status: device.Status,
      type: device.Type
    };
  }

  /**
   * @private
   * Builds the D-Bus path for the given DASD device
   *
   * @param {DASDDevice} device
   * @returns {string}
   */
  devicePath(device) {
    return DASD_DEVICES_NAMESPACE + "/" + device.id;
  }
}

/**
 * Class providing an API for managing iSCSI through D-Bus
 */
class ISCSIManager {
  /**
   * @param {string} service - D-Bus service name
   * @param {string} address - D-Bus address
   */
  constructor(service, address) {
    this.service = service;
    this.address = address;
    this.proxies = {};
  }

  /**
   * @return {DBusClient} client
   */
  client() {
    // return this.assigned_client;
    if (!this._client) {
      this._client = new DBusClient(this.service, this.address);
    }

    return this._client;
  }

  async getInitiatorIbft() {
    const proxy = await this.iscsiInitiatorProxy();
    return proxy.IBFT;
  }

  /**
   * Gets the iSCSI initiator name
   *
   * @returns {Promise<string>}
   */
  async getInitiatorName() {
    const proxy = await this.iscsiInitiatorProxy();
    return proxy.InitiatorName;
  }

  /**
   * Sets the iSCSI initiator name
   *
   * @param {string} value
   */
  async setInitiatorName(value) {
    const proxy = await this.iscsiInitiatorProxy();
    proxy.InitiatorName = value;
  }

  /**
   * Gets the list of exported iSCSI nodes
   *
   * @returns {Promise<ISCSINode[]>}
   *
   * @typedef {object} ISCSINode
   * @property {string} id
   * @property {string} target
   * @property {string} address
   * @property {number} port
   * @property {string} interface
   * @property {boolean} ibft
   * @property {boolean} connected
   * @property {string} startup
   */
  async getNodes() {
    const proxy = await this.iscsiNodesProxy();
    return Object.values(proxy).map(this.buildNode);
  }

  /**
   * Performs an iSCSI discovery
   *
   * @param {string} address - IP address of the iSCSI server
   * @param {number} port - Port of the iSCSI server
   * @param {DiscoverOptions} [options]
   *
   * @typedef {object} DiscoverOptions
   * @property {string} [username] - Username for authentication by target
   * @property {string} [password] - Password for authentication by target
   * @property {string} [reverseUsername] - Username for authentication by initiator
   * @property {string} [reversePassword] - Password for authentication by initiator
   *
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async discover(address, port, options = {}) {
    const auth = removeUndefinedCockpitProperties({
      Username: { t: "s", v: options.username },
      Password: { t: "s", v: options.password },
      ReverseUsername: { t: "s", v: options.reverseUsername },
      ReversePassword: { t: "s", v: options.reversePassword }
    });

    const proxy = await this.iscsiInitiatorProxy();
    return proxy.Discover(address, port, auth);
  }

  /**
   * Sets the startup status of the connection
   *
   * @param {ISCSINode} node
   * @param {String} startup
   */
  async setStartup(node, startup) {
    const path = this.nodePath(node);

    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
    proxy.Startup = startup;
  }

  /**
   * Deletes the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {Promise<number>} 0 on success, 1 on failure if the given path is not exported, 2 on
   *  failure because any other reason.
   */
  async delete(node) {
    const path = this.nodePath(node);

    const proxy = await this.iscsiInitiatorProxy();
    return proxy.Delete(path);
  }

  /**
   * Creates an iSCSI session
   *
   * @param {ISCSINode} node
   * @param {LoginOptions} options
   *
   * @typedef {object} LoginOptions
   * @property {string} [username] - Username for authentication by target
   * @property {string} [password] - Password for authentication by target
   * @property {string} [reverseUsername] - Username for authentication by initiator
   * @property {string} [reversePassword] - Password for authentication by initiator
   * @property {string} [startup] - Startup status for the session
   *
   * @returns {Promise<number>} 0 on success, 1 on failure if the given startup value is not
   *  valid, and 2 on failure because any other reason
   */
  async login(node, options = {}) {
    const path = this.nodePath(node);

    const dbusOptions = removeUndefinedCockpitProperties({
      Username: { t: "s", v: options.username },
      Password: { t: "s", v: options.password },
      ReverseUsername: { t: "s", v: options.reverseUsername },
      ReversePassword: { t: "s", v: options.reversePassword },
      Startup: { t: "s", v: options.startup }
    });

    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
    return proxy.Login(dbusOptions);
  }

  /**
   * Closes an iSCSI session
   *
   * @param {ISCSINode} node
   * @returns {Promise<number>} 0 on success, 1 on failure
   */
  async logout(node) {
    const path = this.nodePath(node);
    // const iscsiNode = new ISCSINodeObject(this.client, path);
    // return await iscsiNode.iface.logout();
    const proxy = await this.client().proxy(ISCSI_NODE_IFACE, path);
    return proxy.Logout();
  }

  onInitiatorChanged(handler) {
    return this.client().onObjectChanged(STORAGE_OBJECT, ISCSI_INITIATOR_IFACE, (changes) => {
      const data = {
        name: changes.InitiatorName?.v,
        ibft: changes.IBFT?.v
      };

      const filtered = Object.entries(data).filter(([, v]) => v !== undefined);
      return handler(Object.fromEntries(filtered));
    });
  }

  async onNodeAdded(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("added", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeChanged(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("changed", (_, proxy) => handler(this.buildNode(proxy)));
  }

  async onNodeRemoved(handler) {
    const proxy = await this.iscsiNodesProxy();
    proxy.addEventListener("removed", (_, proxy) => handler(this.buildNode(proxy)));
  }

  buildNode(proxy) {
    const id = path => path.split("/").slice(-1)[0];

    return {
      id: id(proxy.path),
      target: proxy.Target,
      address: proxy.Address,
      port: proxy.Port,
      interface: proxy.Interface,
      ibft: proxy.IBFT,
      connected: proxy.Connected,
      startup: proxy.Startup
    };
  }

  /**
   * @private
   * Proxy for org.opensuse.Agama.Storage1.ISCSI.Initiator iface
   *
   * @returns {Promise<object>}
   */
  async iscsiInitiatorProxy() {
    if (!this.proxies.iscsiInitiator) {
      this.proxies.iscsiInitiator = await this.client().proxy(ISCSI_INITIATOR_IFACE, STORAGE_OBJECT);
    }

    return this.proxies.iscsiInitiator;
  }

  /**
   * @private
   * Proxy for objects implementing org.opensuse.Agama.Storage1.ISCSI.Node iface
   *
   * @note The ISCSI nodes are dynamically exported.
   *
   * @returns {Promise<object>}
   */
  async iscsiNodesProxy() {
    if (!this.proxies.iscsiNodes)
      this.proxies.iscsiNodes = await this.client().proxies(ISCSI_NODE_IFACE, ISCSI_NODES_NAMESPACE);

    return this.proxies.iscsiNodes;
  }

  /**
   * @private
   * Builds the D-Bus path for the given iSCSI node
   *
   * @param {ISCSINode} node
   * @returns {string}
   */
  nodePath(node) {
    return ISCSI_NODES_NAMESPACE + "/" + node.id;
  }
}

/**
 * Storage base client
 *
 * @ignore
 */
class StorageBaseClient {
  static SERVICE = "org.opensuse.Agama.Storage1";

  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(StorageBaseClient.SERVICE, address);
    this.system = new DevicesManager(this.client, STORAGE_SYSTEM_NAMESPACE);
    this.proposal = new ProposalManager(this.client, this.system);
    this.iscsi = new ISCSIManager(StorageBaseClient.SERVICE, address);
    this.dasd = new DASDManager(StorageBaseClient.SERVICE, address);
    this.proxies = {
      storage: this.client.proxy(STORAGE_IFACE)
    };
  }

  /**
   * Probes the system
   */
  async probe() {
    const proxy = await this.proxies.storage;
    return proxy.Probe();
  }

  /**
   * Whether the system is in a deprecated status
   *
   * @returns {Promise<boolean>}
   */
  async isDeprecated() {
    const proxy = await this.proxies.storage;
    return proxy.DeprecatedSystem;
  }

  /**
   * Runs a handler function when the system becomes deprecated
   *
   * @callback handlerFn
   * @return {void}
   *
   * @param {handlerFn} handler
   */
  onDeprecate(handler) {
    return this.client.onObjectChanged(STORAGE_OBJECT, STORAGE_IFACE, (changes) => {
      if (changes.DeprecatedSystem?.v) return handler();
    });
  }
}

/**
 * Allows interacting with the storage settings
 */
class StorageClient extends WithIssues(
  WithProgress(
    WithStatus(StorageBaseClient, STORAGE_OBJECT), STORAGE_OBJECT
  ), STORAGE_OBJECT
) { }

export { StorageClient };
