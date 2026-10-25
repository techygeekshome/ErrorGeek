<div align="center">

<img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/icons/icon128.png" alt="ErrorGeek logo" width="96" height="96">

# ErrorGeek: Windows Error Code Lookup

**Look up any Windows error code offline: HRESULT, Win32, NTSTATUS and Windows Update codes, with names, meanings and links.**

[![Version](https://img.shields.io/github/v/release/techygeekshome/ErrorGeek?label=version&color=4c9bff)](https://github.com/techygeekshome/ErrorGeek/releases)
[![Platform](https://img.shields.io/badge/browser-Chrome%20%7C%20Edge%20%7C%20Firefox-0078d4)](#%EF%B8%8F-download--install)
[![License](https://img.shields.io/badge/license-GPL--3.0-3fb950)](LICENSE)
[![Made by TechyGeeksHome](https://img.shields.io/badge/made%20by-TechyGeeksHome-b191f2)](https://techygeekshome.info)
[![Support on Ko-fi](https://img.shields.io/badge/support-Ko--fi-ff5e5b)](https://ko-fi.com/techygeekshome)

[Download](#%EF%B8%8F-download--install) · [Features](#-what-it-does) · [Privacy](#-privacy) · [Full guide](https://techygeekshome.info/browser-extensions/errorgeek/) · [License](#-license)

</div>

---

## 🎬 See it in action

[![ErrorGeek demo video](https://img.youtube.com/vi/tpGkwvG6tq4/maxresdefault.jpg)](https://www.youtube.com/watch?v=tpGkwvG6tq4)

---

Look up any Windows error code in a second, without leaving the page. Type or paste a code, or select one on any web page and right-click **Look up error code**. ErrorGeek shows the name, the meaning, how the number breaks down and, for common codes, what to try first. It all comes from a list built into the extension, so it works offline.

The full guide, with every step explained, is on [TechyGeeksHome](https://techygeekshome.info/browser-extensions/errorgeek/).

## 📸 Screenshots

<p float="left">
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-access-denied.jpg" width="49%" />
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-configmgr.jpg" width="49%" />
</p>
<p float="left">
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-menu.jpg" width="49%" />
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-ntstatus.jpg" width="49%" />
</p>
<p float="left">
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-ticket.jpg" width="49%" />
  <img src="https://raw.githubusercontent.com/techygeekshome/ErrorGeek/main/screenshots/errorgeek-windows-update.jpg" width="49%" />
</p>

## ✨ What it does

- **Reads any format**: `0x80070005`, `80070005`, `-2147024891`, `2147942405`, `5`, `0xC0000005`, and codes inside a line of log text.
- **Shows every form of the number**: hex, decimal and signed (the negative number PowerShell and some logs print).
- **Breaks the code down**: HRESULT or NTSTATUS, severity, facility (name and number) and code.
- **Names and meanings** for over 3,500 Win32 errors, 4,200 HRESULTs, 2,900 NTSTATUS codes and 465 Windows Update codes, with message text for over 3,100 of them.
- **Finds the error inside the error**: an HRESULT like `0x80070005` also shows the Win32 error it wraps (`ERROR_ACCESS_DENIED`), and the same for wrapped NTSTATUS and Setup API codes.
- **Windows Update codes** (`0x8024xxxx`) with short plain English notes for the common ones.
- **Configuration Manager (SCCM) and Intune codes** (`0x87D0xxxx`, `0x87D1xxxx`) are decoded, with short notes for the common ones (like `0x87D00324` and `0x87D00607`).
- **Windows servicing codes** (`0x800F08xx`) such as `0x800F081F` and `0x800F0922`.
- **How to fix**: short, plain English tips for about 70 of the codes admins see most, including which log to check.
- **Search links** for TechyGeeksHome and Microsoft Learn on every result.
- **Recent lookups** in the popup, so you can jump back to a code.

## 🚫 What it won't do

- It does not send your codes anywhere. Search links only open when you click them.
- It does not have message text for every code. Where the open source lists only have a name, ErrorGeek says so and gives a reading of the name instead.
- It only has notes for the most common Configuration Manager and Intune codes, because no open licence list of them exists. For the rest it decodes the parts and gives you search links.
- The fix tips are a starting point, not a full guide. Always check the logs on the device.

## ⬇️ Download & install

Pick the download for your browser from the [latest release](https://github.com/techygeekshome/ErrorGeek/releases/latest).

| Browser | Download |
|---|---|
| Chrome, Brave, Opera, Vivaldi | `ErrorGeek-chrome.zip` |
| Microsoft Edge | `ErrorGeek-edge.zip` |
| Firefox (142 or newer) | `ErrorGeek-firefox.zip` |

`ErrorGeek.zip` is the same package as the Chrome and Edge downloads.

### Chrome, Edge, Brave, Opera and Vivaldi

1. Unzip the download somewhere you'll keep it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the `errorgeek` folder.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `ErrorGeek-firefox.zip`.

Firefox removes temporary add-ons when it closes.

### Build it yourself

The code in this repo is the Chromium version. `manifest.firefox.json` is the Firefox manifest. Run `./build.sh` to make every package in `dist/`.

## 🧭 How to use

1. Click the ErrorGeek icon and type or paste a code, then press Enter.
2. Or select a code on any web page, right-click it and pick **Look up error code**. A small window opens with the answer.
3. Click a name to copy it, or use the search links for more help.

## ⚙️ How it works

- `decode.js` finds the code in the text, works out its hex, decimal and signed forms, splits it into its parts and looks it up.
- `errors.json` is the offline list. `tools/build_db.py` builds it from the Wine, ReactOS and mingw-w64 source files listed in `LICENSE-data.txt`. `tools/notes.json` (Windows Update notes) and `tools/extras.json` (ConfigMgr, Intune and servicing notes, and the fix tips) are written for ErrorGeek and merged in by `tools/add_extras.py`.
- `background.js` only adds the right-click menu and opens the lookup window.
- `tests/unit.test.js` checks the parser and the lookups (`node tests/unit.test.js`).

## 🔒 Privacy

ErrorGeek has no account, no analytics and sends nothing anywhere. Every lookup happens on your own computer. The only thing it stores is your list of recent lookups, on your own computer.

## ☕ Support

ErrorGeek is free and always will be. If it saved you some time, you can [buy us a coffee on Ko-fi](https://ko-fi.com/techygeekshome). Welcome, but never expected.

## 🐛 Support & contributing

Found a bug or have a request? [Open an issue](https://github.com/techygeekshome/ErrorGeek/issues) or [get in touch](https://techygeekshome.info/contact/). Pull requests are welcome.

## 📄 License

GPL-3.0. Free for everyone, including commercial use.

The error list is built from open source projects: Wine (LGPL-2.1-or-later), ReactOS (GPL-2.0-or-later) and mingw-w64 (public domain). See `LICENSE-data.txt` for the exact files and versions. No text was copied from Microsoft documentation: the notes and fix tips are our own words.

ErrorGeek is an independent tool made by [TechyGeeksHome](https://techygeekshome.info). It is not made by or connected to Microsoft. Windows, Configuration Manager and Intune are trademarks of Microsoft.

© 2026 TechyGeeksHome.

---

<div align="center">

Made with ❤️ by [**TechyGeeksHome**](https://techygeekshome.info)

[Website](https://techygeekshome.info) · [YouTube](https://www.youtube.com/channel/UCtEuFj1SMLiuRoucD1hv8dA) · [X](https://x.com/TechyGeeks1) · [Instagram](https://www.instagram.com/andrewarmstrongtgh/)

</div>
