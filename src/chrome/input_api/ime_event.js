// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Convert Browser Events to IME Events.
 * @author hungte@google.com (Hung-Te Lin)
 */

var ImeEvent = {
  JsKeyCode2Key: function (k) {
    // The KeyboardEvent by browser uses "JavaScript Key Code" and is different
    // from Chrome Extension key names. Ref:
    // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    switch (k) {
      case 8:
        return 'Backspace';
      case 37:
        return 'Left';
      case 38:
        return 'Up';
      case 39:
        return 'Right';
      case 40:
        return 'Down';
      case 27:
        return 'Esc';
      case 186:
        return ';';
      case 187:
        return '=';
      case 188:
        return ',';
      case 189:
        return '-';
      case 190:
        return '.';
      case 191:
        return '/';
      case 192:
        return '`';
      case 219:
        return '{';
      case 220:
        return '\\';
      case 221:
        return '}';
      case 222:
        return "'";
    };
    return String.fromCharCode((96 <= k && k <= 105) ? k - 48 : k);
  },

  ImeKeyEvent: function(ev) {
    // Converts a KeyboardEvent to chrome.input.ime Key Event.
    // The real W3C KeyboardEvent is slightly different from the KeyboardEvent
    // expected in Chrome Extension input API, so let's make a mini
    // implementation.
    return {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      type: ev.type,
      key: this.JsKeyCode2Key(ev.keyCode),
      code: ev.keyCode,
    };
  },

  ImeExtensionIPC: function (type) {
    var kIpcDomain = 'croscin';
    var ipc = new ChromeExtensionIPC.IPC(type, kIpcDomain);
    return {
      ipc: ipc,

      attach: ipc.attach,

      send: function () {
        return ipc.send({
          ime: kIpcDomain,
          args: Array.prototype.slice.call(arguments, 0)
        }); },

      recv: function(callback) {
        ipc.recv(function (evt) {
          if (evt.ime != kIpcDomain)
            return;
          callback.apply(null, evt.args);
        });
      }
    };
  }
};
