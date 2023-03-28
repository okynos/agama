# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "dbus"
require "agama/dbus/bus"
require "agama/dbus/questions"

module Agama
  module DBus
    # D-Bus service (org.opensuse.DInstaller.Questions)
    #
    # It connects to the system D-Bus and answers requests on objects below
    # `/org/opensuse/DInstaller/Questions1`.
    class QuestionsService
      SERVICE_NAME = "org.opensuse.DInstaller.Questions"
      private_constant :SERVICE_NAME

      # D-Bus connection
      #
      # @return [::DBus::Connection]
      attr_reader :bus

      # Constructor
      #
      # @param _config [Config] Configuration object
      # @param logger [Logger]
      def initialize(_config, logger = nil)
        @logger = logger || Logger.new($stdout)
        @bus = Bus.current
      end

      # Exports the software object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }
        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      # Call this from some main loop to dispatch the D-Bus messages
      def dispatch
        bus.dispatch_message_queue
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [::DBus::Service]
      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      # @return [Array<::DBus::Object>]
      def dbus_objects
        @dbus_objects ||= [
          Agama::DBus::Questions.new(logger: logger)
        ]
      end
    end
  end
end
