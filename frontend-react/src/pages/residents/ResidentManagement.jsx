import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Building, FileSpreadsheet, Layers, Users } from "lucide-react";

import { PageHeader } from "@/components/hms/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthContext } from "@/context/AuthContext";
import ResidentDetailDrawer from "@/components/residents/ResidentDetailDrawer";
import ResidentDirectory from "@/components/residents/ResidentDirectory";
import ResidentImport from "@/components/residents/ResidentImport";
import ResidentOccupancy from "@/components/residents/ResidentOccupancy";
import ResidentReports from "@/components/residents/ResidentReports";

export default function ResidentManagement() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const isHeadWarden = user?.role === "HEADWARDEN";

  const [activeTab, setActiveTab] = useState("directory");
  const [selectedResidentId, setSelectedResidentId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectResident = (residentId) => {
    setSelectedResidentId(residentId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t("residents.title", "Hostel Resident Management")}
          description={t("residents.subtitle", "Centralized student directory, room occupancy, guardian emergency records, and resident reporting.")}
        />
      </div>

      <Tabs
        value={activeTab === "import" && !isHeadWarden ? "directory" : activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="directory" className="gap-2">
            <Users className="size-4" />
            <span>{t("residents.title", "Student Directory")}</span>
          </TabsTrigger>
          <TabsTrigger value="occupancy" className="gap-2">
            <Building className="size-4" />
            <span>{t("nav.rooms", "Room Occupancy")}</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Layers className="size-4" />
            <span>{t("residents.reports_tab", "Reports & Analytics")}</span>
          </TabsTrigger>

          {/* CSV Import is strictly exclusive to HEADWARDEN */}
          {isHeadWarden && (
            <TabsTrigger value="import" className="gap-2">
              <FileSpreadsheet className="size-4" />
              <span>{t("common.import", "CSV Import")}</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="directory" className="space-y-4 focus-visible:outline-none">
          <ResidentDirectory onSelectResident={handleSelectResident} />
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4 focus-visible:outline-none">
          <ResidentOccupancy onSelectResident={handleSelectResident} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 focus-visible:outline-none">
          <ResidentReports />
        </TabsContent>

        {isHeadWarden && (
          <TabsContent value="import" className="space-y-4 focus-visible:outline-none">
            <ResidentImport />
          </TabsContent>
        )}
      </Tabs>

      {/* Slide-out Resident Detail Drawer */}
      <ResidentDetailDrawer
        residentId={selectedResidentId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
