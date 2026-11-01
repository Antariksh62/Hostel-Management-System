const fs = require('fs');
const path = require('path');

const bellPath = path.join(__dirname, '../frontend-react/src/components/notifications/AdminNotificationBell.jsx');
let code = fs.readFileSync(bellPath, 'utf8');

// Add import
if (!code.includes('useTranslation')) {
  code = code.replace(
    'import React, { useState, useEffect, useContext, useRef } from "react";',
    'import React, { useState, useEffect, useContext, useRef } from "react";\nimport { useTranslation } from "react-i18next";'
  );
}

// Add hook
if (!code.includes('const { t } = useTranslation();')) {
  code = code.replace(
    'const navigate = useNavigate();',
    'const navigate = useNavigate();\n  const { t } = useTranslation();'
  );
}

// Localized time helper
code = code.replace(
  `  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return \`\${mins}m ago\`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return \`\${hours}h ago\`;
    const days = Math.floor(hours / 24);
    return \`\${days}d ago\`;
  };`,
  `  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.just_now", "Just now");
    if (mins < 60) return t("common.minutes_ago", "{{count}}m ago", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("common.hours_ago", "{{count}}h ago", { count: hours });
    const days = Math.floor(hours / 24);
    return t("common.days_ago", "{{count}}d ago", { count: days });
  };`
);

// Localized Title helper
if (!code.includes('getLocalizedTitle')) {
  code = code.replace(
    '// Fetch notifications from backend',
    `  const getLocalizedTitle = (notif) => {
    if (!notif?.title) return "";
    if (notif.title.includes("New Complaint")) {
      const match = notif.title.match(/\\(([^)]+)\\)/);
      const catKey = match ? match[1] : notif.metadata?.category;
      const transCat = catKey ? t("categories." + catKey, formatCategoryLabel(catKey)) : "";
      return t("notifications.complaint_created", {
        room: notif.metadata?.room || notif.metadata?.doorNumber || "",
        title: transCat || cleanNotificationTitle(notif.title)
      });
    }
    return cleanNotificationTitle(notif.title);
  };

  // Fetch notifications from backend`
  );
}

// Replace UI strings
code = code.replace(
  '<span className="text-sm font-semibold text-foreground">Notifications</span>',
  '<span className="text-sm font-semibold text-foreground">{t("notifications.title", "Notifications")}</span>'
);

code = code.replace(
  'Mark all read\n              </button>',
  '{t("notifications.mark_all_read", "Mark all read")}\n              </button>'
);

code = code.replace(
  'All ({notifications.length})\n            </button>',
  '{t("notifications.all_tab", "All ({{count}})", { count: notifications.length })}\n            </button>'
);

code = code.replace(
  'Unread ({unreadCount})\n            </button>',
  '{t("notifications.unread_tab", "Unread ({{count}})", { count: unreadCount })}\n            </button>'
);

code = code.replace(
  '<p className="text-xs font-medium text-foreground">No notifications</p>',
  '<p className="text-xs font-medium text-foreground">{t("notifications.empty_notifications", "No notifications")}</p>'
);

code = code.replace(
  '{cleanNotificationTitle(notif.title)}',
  '{getLocalizedTitle(notif)}'
);

fs.writeFileSync(bellPath, code, 'utf8');
console.log('✅ AdminNotificationBell.jsx successfully updated with dynamic i18n support!');

