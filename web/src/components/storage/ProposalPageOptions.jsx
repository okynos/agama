/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { useHref } from "react-router-dom";
import { useInstallerClient } from "~/context/installer";
import { If, PageOptions } from "~/components/core";

const DASDLink = () => {
  const href = useHref("/storage/dasd");

  return (
    <PageOptions.Item
      key="dasd-link"
      href={href}
      description="Manage and format"
    >
      DASD
    </PageOptions.Item>
  );
};

const ISCSILink = () => {
  const href = useHref("/storage/iscsi");

  return (
    <PageOptions.Item
      key="iscsi-link"
      href={href}
      description="Connect to iSCSI targets"
    >
      iSCSI
    </PageOptions.Item>
  );
};

export default function ProposalPageOptions () {
  const [showDasdLink, setShowDasdLink] = useState(false);
  const { storage: client } = useInstallerClient();

  useEffect(() => {
    client.dasd.isSupported().then(setShowDasdLink);
  }, [client.dasd]);

  return (
    <PageOptions>
      <PageOptions.Group
        label="Configure"
        key="devices-options"
      >
        <If condition={showDasdLink} then={<DASDLink />} />
        <ISCSILink />
      </PageOptions.Group>
    </PageOptions>
  );
}
