import { writeFile } from "node:fs/promises";
import { ipcMain, dialog, Notification, type BrowserWindow } from "electron";

// Starter IPC handlers backing window.electronAPI (see preload.ts and
// packages/web/src/web/lib/desktop.ts). Fully editable — change, remove, or add
// handlers to fit the app; keep the preload methods and web types in sync.
// openExternal and onDeepLink come from @runablehq/managed-auth (wired in
// preload.ts), not from here.

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  // Dialog
  ipcMain.handle("dialog:open", async (_, opts) => {
    const result = await dialog.showOpenDialog(opts);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:save", async (_, opts) => {
    const result = await dialog.showSaveDialog(opts);
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle("dialog:save-text", async (_, opts, content: unknown) => {
    const text = typeof content === "string" ? content : "";
    if (Buffer.byteLength(text, "utf8") > 2 * 1024 * 1024) {
      throw new Error("Die zu speichernde Diagnose ist größer als 2 MB.");
    }
    const result = await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, text, "utf8");
    return result.filePath;
  });

  // Notifications
  ipcMain.handle("notification:show", (_, title: string, body: string) => {
    new Notification({ title, body }).show();
  });

  // Window controls
  ipcMain.handle("window:minimize", () => getWindow()?.minimize());
  ipcMain.handle("window:maximize", () => {
    const win = getWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle("window:close", () => getWindow()?.close());
}
