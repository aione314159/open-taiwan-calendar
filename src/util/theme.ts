import type { App } from "obsidian";

/**
 * Obsidian's own light/dark toggle, reached from the calendar toolbar.
 *
 * The base colour scheme is Obsidian's state, not this plugin's, so nothing
 * here is stored in the plugin settings. `theme:toggle-light-dark` is the same
 * built-in command the command palette offers, and it already handles the case
 * the plugin would otherwise get wrong: with "Adapt to system" selected it
 * flips the body classes without overwriting the user's choice, and only in the
 * explicit light/dark case does it write the vault config.
 */
const TOGGLE_COMMAND_ID = "theme:toggle-light-dark";

interface CommandHost {
  commands: {
    executeCommandById: (id: string) => boolean;
  };
}

/**
 * Whether the app is currently drawing in dark mode.
 *
 * Read from the body class rather than from the vault config: under "Adapt to
 * system" the config says `system` and says nothing about which of the two is
 * on screen, while the class is what the CSS itself follows.
 */
export const isDarkMode = (): boolean =>
  document.body.classList.contains("theme-dark");

/** Switch between light and dark. */
export const toggleColorScheme = (app: App): void => {
  (app as unknown as CommandHost).commands.executeCommandById(
    TOGGLE_COMMAND_ID
  );
};

/**
 * Call `onChange` whenever the colour scheme changes, and return the
 * unsubscribe function.
 *
 * `css-change` also fires for a theme or snippet change, which is one reason
 * the caller reads `isDarkMode()` again instead of trusting the event to mean
 * "dark toggled". It fires for a toggle made anywhere — the command palette,
 * the appearance settings, another window — so the button never goes stale.
 */
export const subscribeColorScheme = (
  app: App,
  onChange: () => void
): (() => void) => {
  const ref = app.workspace.on("css-change", onChange);
  return () => app.workspace.offref(ref);
};
