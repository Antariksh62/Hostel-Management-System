const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. QuickServiceReporter.jsx
const qsrPath = path.join(__dirname, '../frontend-react/src/components/hms/QuickServiceReporter.jsx');
let qsr = fs.readFileSync(qsrPath, 'utf8');
if (!qsr.includes('useTranslation')) {
  qsr = qsr.replace(
    'import React, { useState, useContext } from "react";',
    'import React, { useState, useContext } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  qsr = qsr.replace(
    'export default function QuickServiceReporter({ onComplaintSubmitted }) {',
    'export default function QuickServiceReporter({ onComplaintSubmitted }) {\n  const { t } = useTranslation();'
  );
  qsr = qsr.replace('label: "No water supply",', 'label: t("categories.NO_WATER_SUPPLY", "No water supply"),');
  qsr = qsr.replace('label: "No electricity",', 'label: t("categories.NO_ELECTRICITY", "No electricity"),');
  qsr = qsr.replace('label: "Wi-Fi not working",', 'label: t("categories.WIFI_NOT_WORKING", "Wi-Fi not working"),');
  fs.writeFileSync(qsrPath, qsr, 'utf8');
  console.log('✅ QuickServiceReporter.jsx updated!');
}

// 2. StudentHome.jsx
const homePath = path.join(__dirname, '../frontend-react/src/pages/student/StudentHome.jsx');
let home = fs.readFileSync(homePath, 'utf8');
if (!home.includes('useTranslation')) {
  home = home.replace(
    'import React, { useContext, useEffect, useState, useCallback } from "react";',
    'import React, { useContext, useEffect, useState, useCallback } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  home = home.replace(
    'export default function StudentHome() {',
    'export default function StudentHome() {\n  const { t } = useTranslation();'
  );
  home = home.replace('title="Home"', 'title={t("nav.home", "Home")}');
  home = home.replace('label="Open requests"', 'label={t("dashboard.open_complaints", "Open requests")}');
  home = home.replace('label="Resolved"', 'label={t("dashboard.resolved", "Resolved")}');
  home = home.replace('label="Your room"', 'label={t("nav.my_room", "Your room")}');
  home = home.replace(
    '<h2 className="text-base font-semibold">Active requests</h2>',
    '<h2 className="text-base font-semibold">{t("dashboard.needs_attention", "Active requests")}</h2>'
  );
  home = home.replace(
    'View all <ArrowRight className="size-4" aria-hidden />',
    '{t("common.view", "View all")} <ArrowRight className="size-4" aria-hidden />'
  );
  fs.writeFileSync(homePath, home, 'utf8');
  console.log('✅ StudentHome.jsx updated!');
}

// 3. StudentRoom.jsx
const roomPath = path.join(__dirname, '../frontend-react/src/pages/student/StudentRoom.jsx');
let room = fs.readFileSync(roomPath, 'utf8');
if (!room.includes('useTranslation')) {
  room = room.replace(
    'import React, { useContext, useEffect, useState } from "react";',
    'import React, { useContext, useEffect, useState } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  room = room.replace(
    'export default function StudentRoom() {',
    'export default function StudentRoom() {\n  const { t } = useTranslation();'
  );
  room = room.replace('title={`Room ${room}`}', 'title={`${t("common.room", "Room")} ${room}`}');
  room = room.replace('description={`Floor ${floor} · Hostel Accommodation`}', 'description={`${t("common.floor", "Floor")} ${floor} · ${t("common.pict_hostel", "Hostel Accommodation")}`}');
  room = room.replace('["Room number", room]', '[t("auth.room_number", "Room number"), room]');
  room = room.replace('["Floor", `Floor ${floor}`]', '[t("common.floor", "Floor"), `${t("common.floor", "Floor")} ${floor}`]');
  room = room.replace('["Occupancy status", "Allotted & Occupied"]', '[t("common.status", "Occupancy status"), t("status.Active", "Allotted & Occupied")]');
  room = room.replace(
    '<h2 className="mt-8 mb-3 text-sm font-semibold">Maintenance history for this room</h2>',
    '<h2 className="mt-8 mb-3 text-sm font-semibold">{t("nav.history", "Maintenance history for this room")}</h2>'
  );
  fs.writeFileSync(roomPath, room, 'utf8');
  console.log('✅ StudentRoom.jsx updated!');
}

// 4. StudentProfile.jsx
const profPath = path.join(__dirname, '../frontend-react/src/pages/student/StudentProfile.jsx');
let prof = fs.readFileSync(profPath, 'utf8');
if (!prof.includes('useTranslation')) {
  prof = prof.replace(
    'import React, { useContext, useState } from "react";',
    'import React, { useContext, useState } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  prof = prof.replace(
    'export default function StudentProfile() {',
    'export default function StudentProfile() {\n  const { t } = useTranslation();'
  );
  prof = prof.replace('title="Student Profile"', 'title={t("nav.profile", "Student Profile")}');
  prof = prof.replace('Edit Profile\n        </Button>', '{t("common.edit", "Edit Profile")}\n        </Button>');
  prof = prof.replace('Save Changes\n              </Button>', '{t("common.save", "Save Changes")}\n              </Button>');
  prof = prof.replace('Cancel\n              </Button>', '{t("common.cancel", "Cancel")}\n              </Button>');
  fs.writeFileSync(profPath, prof, 'utf8');
  console.log('✅ StudentProfile.jsx updated!');
}

// 5. StaffWork.jsx
const workPath = path.join(__dirname, '../frontend-react/src/pages/staff/StaffWork.jsx');
let work = fs.readFileSync(workPath, 'utf8');
if (!work.includes('useTranslation')) {
  work = work.replace(
    'import React, { useContext, useEffect, useState, useCallback } from "react";',
    'import React, { useContext, useEffect, useState, useCallback } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  work = work.replace(
    'export default function StaffWork() {',
    'export default function StaffWork() {\n  const { t } = useTranslation();'
  );
  work = work.replace('title="My work"', 'title={t("nav.my_work", "My work")}');
  work = work.replace('label="Open jobs"', 'label={t("dashboard.open_complaints", "Open jobs")}');
  work = work.replace('label="In progress"', 'label={t("status.In Progress", "In progress")}');
  work = work.replace('label="Overdue"', 'label={t("dashboard.needs_attention", "Overdue")}');
  work = work.replace('View details\n                    </Button>', '{t("common.view", "View details")}\n                    </Button>');
  work = work.replace('Start work\n                      </Button>', '{t("complaints.mark_in_progress", "Start work")}\n                      </Button>');
  work = work.replace('Mark resolved\n                    </Button>', '{t("complaints.mark_resolved", "Mark resolved")}\n                    </Button>');
  fs.writeFileSync(workPath, work, 'utf8');
  console.log('✅ StaffWork.jsx updated!');
}

// 6. ResidentManagement.jsx
const resPath = path.join(__dirname, '../frontend-react/src/pages/residents/ResidentManagement.jsx');
let resMgt = fs.readFileSync(resPath, 'utf8');
if (!resMgt.includes('useTranslation')) {
  resMgt = resMgt.replace(
    'import React, { useState, useContext } from "react";',
    'import React, { useState, useContext } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  resMgt = resMgt.replace(
    'export default function ResidentManagement() {',
    'export default function ResidentManagement() {\n  const { t } = useTranslation();'
  );
  resMgt = resMgt.replace('title="Hostel Resident Management"', 'title={t("residents.title", "Hostel Resident Management")}');
  resMgt = resMgt.replace('description="Centralized student directory, room occupancy, guardian emergency records, and resident reporting."', 'description={t("residents.subtitle", "Centralized student directory, room occupancy, guardian emergency records, and resident reporting.")}');
  resMgt = resMgt.replace('<span>Student Directory</span>', '<span>{t("residents.title", "Student Directory")}</span>');
  resMgt = resMgt.replace('<span>Room Occupancy</span>', '<span>{t("nav.rooms", "Room Occupancy")}</span>');
  resMgt = resMgt.replace('<span>Reports & Analytics</span>', '<span>{t("nav.staff_performance", "Reports & Analytics")}</span>');
  resMgt = resMgt.replace('<span>CSV Import</span>', '<span>{t("common.import", "CSV Import")}</span>');
  fs.writeFileSync(resPath, resMgt, 'utf8');
  console.log('✅ ResidentManagement.jsx updated!');
}

// 7. WifiInchargeDashboard.jsx
const wifiPath = path.join(__dirname, '../frontend-react/src/pages/wifi/WifiInchargeDashboard.jsx');
let wifi = fs.readFileSync(wifiPath, 'utf8');
if (!wifi.includes('useTranslation')) {
  wifi = wifi.replace(
    'import React, { useState, useEffect, useContext } from "react";',
    'import React, { useState, useEffect, useContext } from "react";\nimport { useTranslation } from "react-i18next";'
  );
  wifi = wifi.replace(
    'export default function WifiInchargeDashboard() {',
    'export default function WifiInchargeDashboard() {\n  const { t } = useTranslation();'
  );
  wifi = wifi.replace('product="Hostel Management"', 'product={t("common.app_title", "Hostel Management")}');
  wifi = wifi.replace('roleLabel="Wi-Fi Specialist Portal"', 'roleLabel={t("wifi.title", "Wi-Fi Specialist Portal")}');
  wifi = wifi.replace('{ to: "/wifi-dashboard", label: "Wi-Fi Operations", icon: Wifi }', '{ to: "/wifi-dashboard", label: t("wifi.queue_heading", "Wi-Fi Operations"), icon: Wifi }');
  wifi = wifi.replace('{ to: "/wifi-dashboard/heatmap", label: "Signal Heat Map", icon: Activity }', '{ to: "/wifi-dashboard/heatmap", label: t("nav.service_monitor", "Signal Heat Map"), icon: Activity }');
  wifi = wifi.replace('Sign out\n          </Button>', '{t("common.sign_out", "Sign out")}\n          </Button>');
  fs.writeFileSync(wifiPath, wifi, 'utf8');
  console.log('✅ WifiInchargeDashboard.jsx updated!');
}

console.log('🎉 All dashboard views patched with translations successfully!');

