/**
 * English is the source language: every key the plugin can ask for exists here,
 * and every other locale is a partial overlay on top of it. That is what makes
 * "missing key falls back to English" a type-level guarantee rather than a hope.
 *
 * `{placeholder}` tokens are substituted by `t()` only when the call site passes
 * a matching variable, so literal braces in sample JSON and in Periodic Notes'
 * own `{{date}}` tokens survive untouched.
 */
export const en = {
  // ---------------------------------------------------------------- shared
  "common.cancel": "Cancel",
  "common.create": "Create",

  // ---------------------------------------------------------------- commands and plugin chrome
  "command.openSidebar": "Open calendar in the sidebar",
  "command.toggleFloatingPanel": "Toggle floating calendar",
  "hoverSource.display": "Taiwan Calendar",
  "view.calendarTitle": "Calendar",
  "notice.overridesDropped":
    "Holiday overrides: {count} malformed entries were ignored",
  "notice.saveFailed": "Could not save the settings. Check that the vault is writable.",
  "notice.loadFailed": "Could not read the saved settings. Falling back to the defaults.",

  // ---------------------------------------------------------------- calendar
  "calendar.settings": "Taiwan Calendar settings",
  "calendar.modeToday": "Today",
  "calendar.modeMonth": "Month",
  "calendar.modeYear": "Year",
  "calendar.prevYear": "Previous year",
  "calendar.prevMonth": "Previous month",
  "calendar.nextMonth": "Next month",
  "calendar.nextYear": "Next year",
  "calendar.weekColumnHeader": "Wk",
  "calendar.badgeToday": "Now",
  "calendar.badgeHoliday": "Off",
  "calendar.badgeWorkday": "Work",
  /** moment format string for the year shown in the calendar header */
  "calendar.headerYearFormat": "YYYY",
  /** moment format string for the month shown in the calendar header */
  "calendar.headerMonthFormat": "MMMM",
  "calendar.headerQuarter": "Q{quarter}",
  /** moment format string for the solar month inside a year-view month cell */
  "calendar.monthCellFormat": "MMM",
  /**
   * The lunar month stays in Chinese in every locale: it is calendar data
   * produced by lunar-typescript, the same way 初三 or 大暑 are, and this plugin
   * exists precisely to show it.
   */
  "calendar.monthCell": "{month} ({lunar}月)",
  "calendar.quarterCell1": "Q1",
  "calendar.quarterCell2": "Q2",
  "calendar.quarterCell3": "Q3",
  "calendar.quarterCell4": "Q4",
  /**
   * Second line of a quarter cell. Empty in English because "Q1" already says
   * everything; Traditional Chinese needs 季 under 第一. An empty value means
   * the second line is not rendered at all.
   */
  "calendar.quarterCellUnit": "",

  // ---------------------------------------------------------------- note types
  "noteType.daily": "Daily note",
  "noteType.weekly": "Weekly note",
  "noteType.monthly": "Monthly note",
  "noteType.quarterly": "Quarterly note",
  "noteType.yearly": "Yearly note",
  "hint.granularityDisabled":
    "Periodic Notes has {noteType} turned off. Enable it in the Periodic Notes settings before you can create one.",

  // ---------------------------------------------------------------- note menu and note creation
  "menu.openInNewTab": "Open in a new tab",
  "menu.openToTheRight": "Open to the right",
  "menu.copyLunarDate": "Copy the lunar date",
  "menu.createNote": "Create {noteType}",
  "notice.copied": "Copied: {text}",
  "notice.copyFailed":
    "Copy failed. Check that the system clipboard permission is granted.",
  "notice.quickAddMissing":
    "The QuickAdd plugin was not found. Install it, or turn this option off.",
  "confirm.createNoteTitle": "Create {noteType}",
  "confirm.createNoteText": "{filename} does not exist. Create it?",

  // ---------------------------------------------------------------- floating panel
  "floating.title": "Calendar",
  "floating.dock": "Dock to a corner",
  "floating.settings": "Settings",
  "floating.close": "Close",
  "floating.dockTopLeft": "Dock top left",
  "floating.dockTopRight": "Dock top right",
  "floating.dockBottomLeft": "Dock bottom left",
  "floating.dockBottomRight": "Dock bottom right",

  // ---------------------------------------------------------------- holiday override editor
  "holidayOverride.formatButton": "Format",
  "holidayOverride.formatButtonAria": "Format the JSON content",
  "holidayOverride.exampleButton": "Insert example",
  "holidayOverride.exampleButtonAria": "Insert an example for tomorrow",
  "holidayOverride.exampleName": "Sample holiday",
  "holidayOverride.droppedNotice": "{count} malformed entries were ignored",
  "holidayOverride.exampleNotice":
    "An example for tomorrow was inserted. Edit it, then click outside the box to apply it.",
  "holidayOverride.emptyError": "The box is empty; there is no JSON to format.",
  "holidayOverride.reindentNotice":
    "Re-indented. Click outside the box to apply it.",
  "holidayOverride.formatError":
    "Invalid JSON, cannot format (your text is left exactly as it was): {message}",
  "holidayOverride.shapeError":
    "Must be an object shaped as { year: array of holidays }",
  "holidayOverride.parseError": "Invalid JSON, not saved: {message}",
  "holidayOverride.placeholder":
    '{"2027": [{"date": "10-09", "name": "Day off in lieu", "isHoliday": true, "isMakeupWorkday": false}]}',

  // ---------------------------------------------------------------- settings page
  /**
   * Intentionally absent from every other locale: the plugin name is a proper
   * noun and is identical everywhere. It is also the live proof that a key
   * missing from a locale renders the English string instead of the raw key.
   */
  "settings.heroTitle": "Open Taiwan Calendar",
  "settings.heroSubtitle":
    "ROC festivals and the Chinese lunar calendar: public holidays, day-off adjustments, lunar dates and solar terms",
  "settings.appearanceCardTitle": "Appearance",
  "settings.appearanceCardSubtitle": "Adjust how the calendar is laid out",
  "settings.layoutName": "Layout mode",
  "settings.layoutDesc":
    "Normal is roomier and easier to read; Compact shrinks the date cells and the gaps so the same width fits more",
  "settings.layoutNormal": "Normal",
  "settings.layoutCompact": "Compact",
  "settings.dotSizeName": "Dot size",
  "settings.dotSizeDesc":
    "How big the dots along the bottom of a date are — the one marking a day that has a note, and one per event.",
  "settings.dotSizeSmall": "Small",
  "settings.dotSizeMedium": "Medium",
  "settings.dotSizeLarge": "Large",
  "settings.pastTransparentName": "Fade past dates",
  "settings.hoverPreviewName": "Hover preview",
  "settings.hoverPreviewDesc":
    "Show the note preview popup when the pointer rests on a date. Off stops this calendar’s popup without touching the core Page Preview plugin, which other plugins share.",
  "settings.pastTransparentDesc":
    "When on, dates before today are drawn slightly transparent",
  "settings.readingViewEventsName": "Show entries in reading view",
  "settings.readingViewEventsDesc":
    "Draw this note's reminders and events as a block at the top of reading view. Off leaves the frontmatter untouched; the entries are still there and still on the calendar.",
  "settings.floatingCardTitle": "Floating calendar",
  "settings.floatingDesc":
    "A draggable, resizable full-month calendar panel layered over the Obsidian main window",
  "settings.floatingVisibleName": "Show the floating panel",
  "settings.floatingWidthName": "Width",
  "settings.floatingWidthDesc":
    "Floating panel width in pixels; the height follows the same ratio. An open panel updates immediately. Dragging its bottom-right corner resizes it too and remembers the new size",
  "settings.holidayCardTitle": "Holiday data",
  "settings.holidayCardSubtitle":
    "Fixed holidays, the three major lunar festivals and day-off adjustments",
  "settings.holidayIntro":
    "Fixed-date national holidays, the three major lunar festivals (Lunar New Year, Dragon Boat, Mid-Autumn) and the Qingming solar term are all computed algorithmically, as are the three holidays restored by the 2025 amendment — Confucius' Birthday (9/28), Taiwan Retrocession and Guningtou Victory Memorial Day (10/25) and Constitution Day (12/25), which only take effect from 2025 onward — so any year displays correctly. The bundled official day-off adjustment data covers up to {latestYear}. From {nextYear} onward, until an official announcement is published, the plugin falls back to the purely algorithmic version (only the day-off adjustments are missing; national holidays and the major festivals still display).",
  "settings.holidayOverrideTitle": "Day-off adjustment override (JSON)",
  "settings.holidayOverrideSubtitle":
    "Once the Directorate-General of Personnel Administration publishes the calendar for a new year, paste JSON shaped as { year: [ { date, name, isHoliday, isMakeupWorkday } ] } here. It is saved and applied as soon as the box loses focus",
  "settings.notesCardTitle": "Note configuration",
  "settings.notesCardSubtitle":
    "Use the Periodic Notes plugin to configure note paths, templates and folders",
  "settings.periodicNotesLink": "Periodic Notes plugin page",
  "settings.variablesIntro":
    "Lunar calendar variables available in templates (substituted once the note is created; replaced with an empty string when there is no value):",
  "settings.varLunar": 'The full lunar date, e.g. "乙巳蛇年七月初三 大暑"',
  "settings.varSolarTerm":
    'The solar term of the day, e.g. "立春"; empty on days that are not a solar term',
  "settings.varFestivals": "The festival or public holiday name of the day",
  "settings.varGanzhi": 'The sexagenary year, e.g. "乙巳"',
  "settings.varChineseParts": "Lunar year / month / day",
  "settings.varDateStr": "The filename plus the festival name",
  "settings.builtinTokens":
    "The {{date}} / {{time}} / {{title}} tokens Periodic Notes already supports behave exactly as before.",
  "settings.quickAddName": "Use QuickAdd templates",
  "settings.quickAddDesc":
    "Requires the QuickAdd plugin; notes are created by running a QuickAdd template choice",
  "settings.quickAddChoiceTitle": "QuickAdd template choice",
  "settings.quickAddChoiceDesc":
    "The name of the QuickAdd template choice to run. Parameters can be passed to it.",

  // ---------------------------------------------------------------- one-click daily note setup
  "dailySetup.button": "Set up daily notes",
  "dailySetup.buttonTooltip":
    "Works out the difference from your current state and shows a preview; only after you confirm does it create the folder and template, enable daily notes and open today's note",
  "dailySetup.title": "Set up daily notes",
  "dailySetup.lead":
    'Below is the difference actually computed from your vault and your plugins right now; nothing runs until you press "Start setup". The interface language is {language}, so the default names use {localeName}.',
  "dailySetup.localeZhHant": "Traditional Chinese",
  "dailySetup.localeZhHans": "Simplified Chinese",
  "dailySetup.localeEn": "English",
  "dailySetup.stepsHeading": "Will run",
  "dailySetup.blockersHeading": "Cannot be done automatically",
  "dailySetup.safetyNote":
    "Existing folders, templates and notes are never overwritten, and the contents of existing notes are never touched. If any step fails the run stops there and the Periodic Notes settings are restored to exactly what they were beforehand.",
  "dailySetup.start": "Start setup",
  "dailySetup.doneWithSteps": "Daily notes are set up; {count} steps ran",
  "dailySetup.doneNoChange":
    "Daily notes were already set up; nothing was changed",
  "dailySetup.failedNotice": "One-click setup failed. {message}",
  "dailySetup.failedInline":
    "The run failed, stopped, and the settings were restored. {message}",
  "dailySetup.stoppedAt": "Stopped at this step: {message}",
  "dailySetup.providerPeriodicNotes": "the Periodic Notes daily note",
  "dailySetup.providerCoreDailyNotes":
    "the Obsidian core Daily notes plugin",
  "dailySetup.stepFolderCreateAndSet":
    "Create the folder \"{folder}\" and set it as the daily note folder",
  "dailySetup.stepFolderCreateMissing":
    "Create the folder \"{folder}\" (the settings already point at it, but it does not exist)",
  "dailySetup.stepFolderSetExisting":
    "Set the daily note folder to \"{folder}\" (the folder already exists; the files inside it are not touched)",
  "dailySetup.stepFolderSatisfied":
    "The folder \"{folder}\" already exists and is configured; no change",
  "dailySetup.stepEnableAction": "Enable {provider}",
  // Phrased so the sentence does not start with the provider label: that
  // label is written to sit mid-sentence ("Enable the Periodic Notes daily
  // note"), so leading with it produced a lower-case sentence start.
  "dailySetup.stepEnableSatisfied": "Already enabled: {provider}; no change",
  "dailySetup.stepFormatAction": "Set the filename format to {format}",
  "dailySetup.stepFormatSatisfied":
    "The filename format is already {format}; no change",
  "dailySetup.stepTemplateCreateAndSet":
    "Create the template file \"{path}\" and set it as the daily note template",
  "dailySetup.stepTemplateCreateMissing":
    "Create the template file \"{path}\" (the settings already point at it, but the file does not exist)",
  "dailySetup.stepTemplateSetExisting":
    "Set the daily note template to \"{path}\" (the file already exists; its contents are not overwritten)",
  "dailySetup.stepTemplateSatisfied":
    "The template \"{path}\" already exists and is configured; it is not overwritten",
  "dailySetup.stepTodayOpen":
    "Open today's note \"{path}\" (it already exists; its contents are not overwritten)",
  "dailySetup.stepTodayCreate": "Create today's note \"{path}\" and open it",
  "dailySetup.stepErrorMessage": "{action}: {message}",
  "dailySetup.cannotInstall":
    "Obsidian offers no public API for one plugin to install another (only an undocumented internal function, which downloads and runs third-party code over the network; this plugin makes zero outbound requests, so it is not used).",
  "dailySetup.blockerPnMissingTitle": "Periodic Notes is not installed",
  "dailySetup.blockerPnMissingDetail":
    "{cannotInstall} Please install Periodic Notes yourself from Settings → Community plugins. Until then this run only configures the Obsidian core Daily notes plugin, and weekly / monthly / quarterly / yearly notes stay unavailable.",
  "dailySetup.blockerQuickAddMissingTitle": "QuickAdd is not installed",
  "dailySetup.blockerQuickAddMissingDetail":
    '{cannotInstall} Please install it from Settings → Community plugins, then turn on this plugin\'s "Use QuickAdd templates" option. Not installing it does not affect this run.',
  "dailySetup.blockerQuickAddConfiguredTitle":
    "This plugin's daily note is set to go through QuickAdd, but QuickAdd is not installed",
  "dailySetup.blockerQuickAddConfiguredDetail":
    'This run will follow the setting and take the QuickAdd path, which means today\'s note cannot be created. Turn off "Use QuickAdd templates" above, or install QuickAdd and press the button again.',
  "dailySetup.errorNoUpdateSettings":
    "Periodic Notes exposes no usable updateSettings; its settings cannot be written",
  "dailySetup.errorNoCoreOptions":
    "The core Daily notes plugin exposes no usable options object; it cannot be written",
  // ---------------------------------------------------------------- events and reminders
  "command.quickAddEvent": "Add an event or reminder",
  "notice.eventSaved": "Saved: {title}",
  "notice.dailyNoteCreateFailed":
    "Could not create the daily note for {date}. Check that daily notes are set up and the folder is writable.",
  "notice.eventDeleted": "Deleted: {title}",
  "menu.addEvent": "Add an event on this day",
  "command.showEventList": "Show reminders and events",
  "eventList.title": "Reminders and events",
  "eventList.tabReminders": "Reminders",
  "eventList.tabEvents": "Events",
  "eventList.badgeNow": "Now",
  "eventList.empty": "Nothing here yet.",
  "noteEvents.heading": "On this day",
  "menu.addReminderHere": "Add a reminder",
  "menu.addEventHere": "Add an event",

  /** A single-day event shows just the one date; a range shows both ends. */
  "event.dateRange": "{start} – {end}",
  "event.reminderSummary": "Reminder {time}, {offsets}",
  "event.offsetSameDay": "on the day",
  "event.offsetDaysBefore": "{count} d before",
  "event.noReminder": "No reminder",
  /** Joins the offsets inside a reminder summary. */
  "event.offsetSeparator": ", ",

  // ---------------------------------------------------------------- quick add modal
  "quickAdd.title": "Add an event or reminder",
  "quickAdd.inputLabel": "Type it in your own words",
  "quickAdd.inputPlaceholder": "Remind me on Saturday to take the laptop home",
  "quickAdd.inputHint":
    "The date, the length and the title are read out of the sentence. Everything below stays editable, so a sentence that is read wrongly can simply be corrected.",
  "quickAdd.fieldTitle": "Title",
  "quickAdd.fieldStart": "Starts",
  /**
   * A format specifier, not prose: it is a token the user types back verbatim,
   * so it is neither translated nor sentence-cased. The date fields need no
   * such placeholder — they are native date inputs, which show their own.
   */
  "quickAdd.timePlaceholder": "HH:mm",
  "quickAdd.pickDate": "Pick a date",
  "quickAdd.fieldEnd": "Ends",
  "quickAdd.fieldColor": "Colour on the calendar",
  "quickAdd.fieldReminder": "Remind me",
  "quickAdd.fieldOffsets": "Days before",
  "quickAdd.fieldOffsetsDesc":
    "Comma-separated. 0 is the day itself, so \"1, 0\" fires once the day before and once on the day.",
  "quickAdd.fieldTime": "At",
  "quickAdd.submit": "Add",
  "quickAdd.editTitle": "Edit event",
  "quickAdd.save": "Save",
  "quickAdd.errorEmptyTitle": "Give it a title",
  "quickAdd.errorBadDate": "Dates must be YYYY-MM-DD",
  "quickAdd.errorEndBeforeStart": "The end date is before the start date",
  "quickAdd.errorBadTime": "The time must be HH:mm",
  "quickAdd.errorNoOffset": "Enter at least one number, or turn the reminder off",

  // ---------------------------------------------------------------- reminder alerts
  "reminder.modalTitle": "Reminder",
  "reminder.acknowledge": "Got it",
  "reminder.snooze": "Remind me in {minutes} min",
  "reminder.dueToday": "Today",
  "reminder.dueInDays": "In {count} d",
  "reminder.systemPermissionDenied":
    "The system refused desktop notifications, so that channel is skipped. Grant Obsidian notification permission in your operating system settings.",


  // ---------------------------------------------------------------- settings: events and reminders
  "settings.eventsCardTitle": "Events and reminders",
  "settings.reminderColorName": "Reminder colour",
  "settings.reminderColorDesc": "The dot colour for an entry that reminds you",
  "settings.eventColorName": "Event colour",
  "settings.eventColorDesc":
    "The dot colour for an entry that is only marked on the calendar",
  "settings.eventsCardSubtitle":
    "Your own entries live in the daily notes themselves — in the properties of every day they cover, with a checklist generated at the top",
  "settings.reminderEnabledName": "Reminders",
  "settings.reminderEnabledDesc":
    "Off silences every reminder. Events stay on the calendar and in the daily note.",
  "settings.reminderTimeName": "Default time",
  "settings.reminderTimeDesc":
    "HH:mm. A reminder whose time has already passed when Obsidian opens fires on opening rather than being skipped.",
  "settings.reminderOffsetsName": "Default days before",
  "settings.reminderOffsetsDesc":
    "Comma-separated. 0 is the day itself, so \"1, 0\" fires once the day before and once on the day.",
  "settings.reminderChannelModalName": "Dialog",
  "settings.reminderChannelModalDesc":
    "A dialog in the middle of the window that stays until dismissed",
  "settings.reminderChannelNoticeName": "Corner notice",
  "settings.reminderChannelNoticeDesc":
    "Obsidian's own toast in the corner; does not interrupt what you are doing",
  "settings.reminderChannelSystemName": "Desktop notification",
  "settings.reminderChannelSystemDesc":
    "The operating system's notification centre, visible with Obsidian in the background",
  "settings.snoozeName": "Snooze length",
  "settings.snoozeDesc":
    "Minutes that \"remind me later\" pushes a dialog reminder back by",
  "settings.eventListTitle": "Your events",
  "settings.eventListEmpty":
    "Nothing yet. Use the \"Add an event or reminder\" command, or right-click a date on the calendar.",
  "settings.eventListAdd": "Add an event",
  "settings.eventEditAction": "Edit",
  "settings.eventDeleteAction": "Delete",
} as const;

export type TranslationKey = keyof typeof en;
