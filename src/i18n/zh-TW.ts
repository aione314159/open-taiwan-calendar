import type { TranslationKey } from "./en";

/**
 * Traditional Chinese (zh-TW). This is the plugin's primary audience, so the
 * wording here is the original hand-written copy, not a translation of the
 * English source.
 *
 * Typed as `Partial`: anything left out deliberately falls through to English.
 * `settings.heroTitle` is the standing example — the plugin name is a proper
 * noun and reads identically in both locales.
 */
export const zhTW: Partial<Record<TranslationKey, string>> = {
  // ---------------------------------------------------------------- shared
  "common.cancel": "取消",
  "common.create": "建立",

  // ---------------------------------------------------------------- commands and plugin chrome
  "command.openSidebar": "打開日曆側邊欄視圖",
  "command.toggleFloatingPanel": "切換懸浮農民曆",
  "hoverSource.display": "農民曆",
  "view.calendarTitle": "日曆",
  "notice.overridesDropped": "假日覆蓋資料已忽略 {count} 筆格式不符的資料",
  "notice.saveFailed": "設定儲存失敗，請確認保管庫可寫入",
  "notice.loadFailed": "讀取已儲存的設定失敗，改用預設值",

  // ---------------------------------------------------------------- calendar
  "calendar.settings": "農民曆設定",
  "calendar.modeToday": "今",
  "calendar.modeMonth": "月",
  "calendar.modeYear": "年",
  "calendar.prevYear": "前一年",
  "calendar.prevMonth": "前一月",
  "calendar.nextMonth": "後一月",
  "calendar.nextYear": "後一年",
  "calendar.weekColumnHeader": "周",
  "calendar.badgeToday": "今",
  "calendar.badgeHoliday": "休",
  "calendar.badgeWorkday": "班",
  "calendar.headerYearFormat": "YYYY[年]",
  "calendar.headerMonthFormat": "MM[月]",
  "calendar.headerQuarter": "第{quarter}季",
  "calendar.monthCellFormat": "M[月]",
  "calendar.monthCell": "{month}（{lunar}月）",
  "calendar.quarterCell1": "第一",
  "calendar.quarterCell2": "第二",
  "calendar.quarterCell3": "第三",
  "calendar.quarterCell4": "第四",
  "calendar.quarterCellUnit": "季",

  // ---------------------------------------------------------------- note types
  "noteType.daily": "每日筆記",
  "noteType.weekly": "每週筆記",
  "noteType.monthly": "每月筆記",
  "noteType.quarterly": "季度筆記",
  "noteType.yearly": "年度筆記",
  "hint.granularityDisabled":
    "Periodic Notes 未啟用{noteType}，請到 Periodic Notes 設定中開啟後才能建立",

  // ---------------------------------------------------------------- note menu and note creation
  "menu.openInNewTab": "在新分頁開啟",
  "menu.openToTheRight": "在右側開啟",
  "menu.copyLunarDate": "複製農曆日期",
  "menu.createNote": "建立{noteType}",
  "notice.copied": "已複製：{text}",
  "notice.copyFailed": "複製失敗，請檢查系統剪貼簿權限",
  "notice.quickAddMissing": "未偵測到 QuickAdd 外掛，請先安裝或關閉此選項",
  "confirm.createNoteTitle": "新建{noteType}",
  "confirm.createNoteText": "檔案 {filename} 不存在，是否建立？",

  // ---------------------------------------------------------------- floating panel
  "floating.title": "行事曆",
  "floating.dock": "嵌入角落",
  "floating.settings": "設定",
  "floating.close": "關閉",
  "floating.dockTopLeft": "嵌入左上",
  "floating.dockTopRight": "嵌入右上",
  "floating.dockBottomLeft": "嵌入左下",
  "floating.dockBottomRight": "嵌入右下",

  // ---------------------------------------------------------------- holiday override editor
  "holidayOverride.formatButton": "格式化",
  "holidayOverride.formatButtonAria": "格式化 JSON 內容",
  "holidayOverride.exampleButton": "帶入明日範例",
  "holidayOverride.exampleButtonAria": "帶入明日範例",
  "holidayOverride.exampleName": "範例假日",
  "holidayOverride.droppedNotice": "已忽略 {count} 筆格式不符的資料",
  "holidayOverride.exampleNotice":
    "已帶入明天的範例，改成你要的內容後點一下輸入框外即會套用",
  "holidayOverride.emptyError": "內容是空的，沒有可以格式化的 JSON",
  "holidayOverride.reindentNotice": "已重新縮排，點一下輸入框外即會套用",
  "holidayOverride.formatError":
    "JSON 格式錯誤，無法格式化（內容保持原樣）：{message}",
  "holidayOverride.shapeError": "必須是「年份: 假日陣列」的物件",
  "holidayOverride.parseError": "JSON 格式錯誤，未儲存：{message}",
  "holidayOverride.placeholder":
    '{"2027": [{"date": "10-09", "name": "補假", "isHoliday": true, "isMakeupWorkday": false}]}',

  // ---------------------------------------------------------------- settings page
  "settings.heroSubtitle": "中華民國節慶農民曆，顯示國定假日、補假調移、農曆、節氣",
  "settings.appearanceCardTitle": "外觀設定",
  "settings.appearanceCardSubtitle": "調整日曆的版面顯示模式",
  "settings.layoutName": "版面模式",
  "settings.layoutDesc":
    "正常較寬鬆易讀；緊縮把日期格與間距收小，同樣寬度能塞下更多內容",
  "settings.layoutNormal": "正常",
  "settings.layoutCompact": "緊縮",
  "settings.dotSizeName": "圓點大小",
  "settings.dotSizeDesc": "日期下緣圓點的大小——包含「這天有筆記」那一顆，以及每個活動各一顆。",
  "settings.dotSizeSmall": "小",
  "settings.dotSizeMedium": "中",
  "settings.dotSizeLarge": "大",
  "settings.pastTransparentName": "已過去時間半透明",
  "settings.hoverPreviewName": "滑鼠停留顯示預覽",
  "settings.hoverPreviewDesc":
    "滑鼠停在日期上時彈出該筆記的預覽視窗。關掉只停用本插件的預覽，不動到其他插件共用的「頁面預覽」核心插件。",
  "settings.pastTransparentDesc": "啟用後，今天之前的日期會稍微透明一些",
  "settings.floatingCardTitle": "懸浮農民曆",
  "settings.floatingDesc":
    "在 Obsidian 主視窗上疊加可拖曳、可縮放的完整月曆懸浮面板",
  "settings.floatingVisibleName": "顯示懸浮視窗",
  "settings.floatingWidthName": "寬度",
  "settings.floatingWidthDesc":
    "懸浮視窗寬度（像素），高度依比例自動換算；已開啟的視窗會即時跟著變。拖曳右下角同樣可調整並記住新大小",
  "settings.holidayCardTitle": "節慶資料",
  "settings.holidayCardSubtitle": "固定假日、農曆三大節與補假調移資料",
  "settings.holidayIntro":
    "固定日期國定假日、農曆三大節（春節／端午／中秋）＋清明節氣，以及 2025 年修法新增的孔子誕辰紀念日（9/28）、臺灣光復暨金門古寧頭大捷紀念日（10/25）、行憲紀念日（12/25，這三個只在 2025 年以後生效）皆以演算法計算，任何年份皆會正確顯示。內建官方補假調移資料涵蓋至 {latestYear} 年；{nextYear} 年以後尚無官方公告的補假調移前，會自動退回純演算法版本（僅缺補假調移，國定假日與三大節仍正常顯示）。",
  "settings.holidayOverrideTitle": "補假調移資料覆蓋（JSON）",
  "settings.holidayOverrideSubtitle":
    "人事行政總處公告新年度行事曆後，可在此貼上 { 年份: [ { date, name, isHoliday, isMakeupWorkday } ] } 格式的 JSON，離開輸入框即儲存並套用",
  "settings.notesCardTitle": "筆記配置",
  "settings.notesCardSubtitle":
    "使用 Periodic Notes 外掛配置筆記檔案路徑、範本與儲存資料夾",
  "settings.periodicNotesLink": "Periodic Notes 外掛頁面",
  "settings.variablesIntro":
    "範本可用的農民曆變數（建檔後自動替換；沒有對應資料時替換成空字串）：",
  "settings.varLunar": "完整農曆，例如「乙巳蛇年七月初三 大暑」",
  "settings.varSolarTerm": "當日節氣，例如「立春」；非節氣日為空",
  "settings.varFestivals": "當日節慶／國定假日名稱",
  "settings.varGanzhi": "年干支，例如「乙巳」",
  "settings.varChineseParts": "農曆年／月／日",
  "settings.varDateStr": "檔名加上節慶名稱",
  "settings.builtinTokens":
    "Periodic Notes 原本就支援的 {{date}}／{{time}}／{{title}} 行為不變。",
  "settings.quickAddName": "是否使用 QuickAdd 模板功能",
  "settings.quickAddDesc": "需要事先安裝 QuickAdd 外掛，使用 QuickAdd 模板命令建立筆記",
  "settings.quickAddChoiceTitle": "QuickAdd 模板命令",
  "settings.quickAddChoiceDesc":
    "設定要執行的 QuickAdd 模板命令名稱，並可傳遞參數給該命令。",

  // ---------------------------------------------------------------- one-click daily note setup
  "dailySetup.button": "一鍵設定每日筆記",
  "dailySetup.buttonTooltip":
    "依目前狀態算出差異後先預覽，確認才建立資料夾與範本、啟用每日筆記，並開啟今日日誌",
  "dailySetup.title": "一鍵設定每日筆記",
  "dailySetup.lead":
    "以下是依你目前的 vault 與外掛狀態實際算出來的差異，按「開始設定」才會執行。介面語言 {language}，所以預設名稱採用{localeName}。",
  "dailySetup.localeZhHant": "繁體中文",
  "dailySetup.localeZhHans": "簡體中文",
  "dailySetup.localeEn": "英文",
  "dailySetup.stepsHeading": "即將執行",
  "dailySetup.blockersHeading": "無法自動完成",
  "dailySetup.safetyNote":
    "已存在的資料夾、範本與日誌一律不覆蓋，也不會動既有筆記的內容。任一步失敗會停下來，並把 Periodic Notes 的設定還原成執行前的樣子。",
  "dailySetup.start": "開始設定",
  "dailySetup.doneWithSteps": "每日筆記設定完成，共執行 {count} 個步驟",
  "dailySetup.doneNoChange": "每日筆記已就緒，未變更任何設定",
  "dailySetup.failedNotice": "一鍵設定失敗，{message}",
  "dailySetup.failedInline": "執行失敗，已停止並還原設定。{message}",
  "dailySetup.stoppedAt": "停在這一步：{message}",
  "dailySetup.providerPeriodicNotes": "Periodic Notes 的每日筆記",
  "dailySetup.providerCoreDailyNotes": "Obsidian 核心「每日筆記」",
  "dailySetup.stepFolderCreateAndSet": "建立資料夾「{folder}」並設為每日筆記資料夾",
  "dailySetup.stepFolderCreateMissing":
    "建立資料夾「{folder}」（設定已指向它，但資料夾不存在）",
  "dailySetup.stepFolderSetExisting":
    "把每日筆記資料夾設為「{folder}」（資料夾已存在，不動裡面的檔案）",
  "dailySetup.stepFolderSatisfied": "資料夾「{folder}」已存在且已設定，不變更",
  // The space after 啟用 is load-bearing: without it the Western plugin name is
  // measured as glued to the Chinese verb — 「啟用Periodic Notes 的每日筆記」.
  "dailySetup.stepEnableAction": "啟用 {provider}",
  "dailySetup.stepEnableSatisfied": "{provider}已啟用，不變更",
  "dailySetup.stepFormatAction": "設定檔名格式 {format}",
  "dailySetup.stepFormatSatisfied": "檔名格式已是 {format}，不變更",
  "dailySetup.stepTemplateCreateAndSet": "建立範本檔「{path}」並設為每日筆記範本",
  "dailySetup.stepTemplateCreateMissing":
    "建立範本檔「{path}」（設定已指向它，但檔案不存在）",
  "dailySetup.stepTemplateSetExisting":
    "把每日筆記範本設為「{path}」（檔案已存在，不覆蓋內容）",
  "dailySetup.stepTemplateSatisfied": "範本「{path}」已存在且已設定，不覆蓋",
  "dailySetup.stepTodayOpen": "開啟今日日誌「{path}」（已存在，不覆蓋內容）",
  "dailySetup.stepTodayCreate": "建立今日日誌「{path}」並開啟",
  "dailySetup.stepErrorMessage": "{action}：{message}",
  "dailySetup.cannotInstall":
    "Obsidian 沒有公開 API 讓外掛安裝其他外掛（只有未公開的內部函式，會對外下載並執行第三方程式碼，本外掛堅持零對外請求所以不使用）。",
  "dailySetup.blockerPnMissingTitle": "Periodic Notes 未安裝",
  "dailySetup.blockerPnMissingDetail":
    "{cannotInstall}請自行到 設定 → 社群外掛 安裝 Periodic Notes；在那之前這次只會設定 Obsidian 核心的「每日筆記」，週／月／季／年筆記仍然無法使用。",
  "dailySetup.blockerQuickAddMissingTitle": "QuickAdd 未安裝",
  "dailySetup.blockerQuickAddMissingDetail":
    "{cannotInstall}請自行到 設定 → 社群外掛 安裝後，再開啟本外掛的「是否使用 QuickAdd 模板功能」選項。不裝也不影響這次設定。",
  "dailySetup.blockerQuickAddConfiguredTitle":
    "本外掛的每日筆記已設為走 QuickAdd，但 QuickAdd 沒裝",
  "dailySetup.blockerQuickAddConfiguredDetail":
    "這次會照設定走 QuickAdd 路徑，結果是建不出今日日誌。請先關掉上面的「是否使用 QuickAdd 模板功能」，或安裝 QuickAdd 之後再按一次。",
  "dailySetup.errorNoUpdateSettings":
    "Periodic Notes 沒有可用的 updateSettings，無法寫入設定",
  "dailySetup.errorNoCoreOptions": "核心「每日筆記」沒有可用的設定物件，無法寫入",

  // ---------------------------------------------------------------- events and reminders
  "command.quickAddEvent": "新增活動／提醒",
  "notice.eventSaved": "已儲存：{title}",
  "notice.dailyNoteCreateFailed":
    "無法建立 {date} 的每日筆記，請確認每日筆記已設定且資料夾可寫入。",
  "notice.eventDeleted": "已刪除：{title}",
  "menu.addEvent": "在這天新增活動",
  "command.showEventList": "顯示提醒與活動",
  "eventList.title": "提醒與活動",
  "eventList.tabReminders": "提醒",
  "eventList.tabEvents": "活動",
  "eventList.badgeNow": "進行中",
  "eventList.empty": "還沒有任何項目。",
  "menu.addReminderHere": "新增提醒",
  "menu.addEventHere": "新增活動",

  "event.dateRange": "{start} – {end}",
  "event.reminderSummary": "提醒 {time}，{offsets}",
  "event.offsetSameDay": "當天",
  "event.offsetDaysBefore": "前 {count} 天",
  "event.noReminder": "不提醒",
  "event.offsetSeparator": "、",

  // ---------------------------------------------------------------- quick add modal
  "quickAdd.title": "新增活動／提醒",
  "quickAdd.inputLabel": "用你自己的話打一句",
  "quickAdd.inputPlaceholder": "提醒我週六要把 macbook pro 16 寸帶回家",
  "quickAdd.inputHint":
    "日期、天數與標題會從句子裡讀出來。下面全部可以改，讀錯了直接改掉就好。",
  "quickAdd.fieldTitle": "標題",
  "quickAdd.fieldStart": "開始",
  "quickAdd.fieldEnd": "結束",
  "quickAdd.pickDate": "選擇日期",
  "quickAdd.fieldColor": "行事曆上的顏色",
  "quickAdd.fieldReminder": "要提醒我",
  "quickAdd.fieldOffsets": "提前幾天",
  "quickAdd.fieldOffsetsDesc":
    "用逗號分隔。0 是當天，所以「1, 0」是前一天一次、當天一次。",
  "quickAdd.fieldTime": "時間",
  "quickAdd.submit": "新增",
  "quickAdd.editTitle": "編輯活動",
  "quickAdd.save": "儲存",
  "quickAdd.errorEmptyTitle": "請填標題",
  "quickAdd.errorBadDate": "日期格式必須是 YYYY-MM-DD",
  "quickAdd.errorEndBeforeStart": "結束日期早於開始日期",
  "quickAdd.errorBadTime": "時間格式必須是 HH:mm",
  "quickAdd.errorNoOffset": "至少填一個數字，或把提醒關掉",

  // ---------------------------------------------------------------- reminder alerts
  "reminder.modalTitle": "提醒",
  "reminder.acknowledge": "知道了",
  "reminder.snooze": "{minutes} 分鐘後再提醒",
  "reminder.dueToday": "今天",
  "reminder.dueInDays": "{count} 天後",
  "reminder.systemPermissionDenied":
    "系統拒絕了桌面通知，這個管道跳過。請到作業系統設定給 Obsidian 通知權限。",


  // ---------------------------------------------------------------- settings: events and reminders
  "settings.eventsCardTitle": "活動與提醒",
  "settings.reminderColorName": "提醒圓點顏色",
  "settings.reminderColorDesc": "會提醒你的項目，圓點用這個顏色",
  "settings.eventColorName": "活動圓點顏色",
  "settings.eventColorDesc": "只標在行事曆上、不提醒的項目，圓點用這個顏色",
  "settings.eventsCardSubtitle":
    "項目就存在每日筆記裡——寫進所涵蓋每一天的屬性，並在最上方生成可打勾的清單",
  "settings.reminderEnabledName": "提醒功能",
  "settings.reminderEnabledDesc":
    "關閉後所有提醒都不會出現。活動仍會顯示在行事曆與每日筆記上。",
  "settings.reminderTimeName": "預設提醒時間",
  "settings.reminderTimeDesc":
    "HH:mm。若 Obsidian 開啟時該時間已過，會在開啟當下補提醒，不會直接跳過。",
  "settings.reminderOffsetsName": "預設提前天數",
  "settings.reminderOffsetsDesc":
    "用逗號分隔。0 是當天，所以「1, 0」是前一天一次、當天一次。",
  "settings.reminderChannelModalName": "彈出視窗",
  "settings.reminderChannelModalDesc": "畫面正中央的視窗，不按掉不會消失",
  "settings.reminderChannelNoticeName": "角落提示",
  "settings.reminderChannelNoticeDesc": "Obsidian 內建的角落浮動提示，不打斷手邊工作",
  "settings.reminderChannelSystemName": "系統桌面通知",
  "settings.reminderChannelSystemDesc":
    "作業系統的通知中心，Obsidian 沒開在前景也看得到",
  "settings.snoozeName": "稍後提醒間隔",
  "settings.snoozeDesc": "按「稍後再提醒」時往後延幾分鐘",
  "settings.eventListTitle": "你的活動",
  "settings.eventListEmpty":
    "還沒有任何項目。用「新增活動／提醒」命令，或在行事曆日期上按右鍵。",
  "settings.eventListAdd": "新增活動",
  "settings.eventEditAction": "編輯",
  "settings.eventDeleteAction": "刪除",
};
