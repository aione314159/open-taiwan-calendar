import type { App } from "obsidian";

/** The id from manifest.json. The React tree has no plugin instance, and this constant is all it needs */
export const PLUGIN_ID = "open-taiwan-calendar";

interface SettingHost {
  setting: {
    open: () => void;
    openTabById: (id: string) => void;
    close: () => void;
  };
}

/**
 * Open this plugin's settings page.
 *
 * It needs only `app.setting` and the manifest id (a constant), never a plugin
 * instance — which is why it lives in the dependency-free util layer, shared by
 * main.ts, the floating panel and the sidebar, instead of threading a plugin
 * instance down through the React tree for the sake of one button.
 */
export const openPluginSettings = (app: App, pluginId = PLUGIN_ID): void => {
  const { setting } = app as unknown as SettingHost;
  setting.open();
  setting.openTabById(pluginId);
};

/**
 * Close the settings window.
 * After "Set up daily notes" creates today's note the user has to actually see
 * it. With the settings window still covering the screen the file is open but
 * nothing visibly changed, which reads as the button having done nothing.
 */
export const closePluginSettings = (app: App): void => {
  (app as unknown as SettingHost).setting.close();
};
