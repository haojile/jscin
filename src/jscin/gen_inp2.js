// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module, Version 2 (from scratch).
 * @author hungte@google.com (Hung-Te Lin)
 */

GenInp2 = function(name, conf) {
  var self = this;
  self.name = name;

  if (!conf)
    conf = jscin.getTableData(name);

  if (!conf) {
    trace('failed to load ', name);
    return;
  }
  trace('GenInp2: conf loaded');

  // Declaration of states
  self.STATE_COMPOSITION = 1;
  self.STATE_CANDIDATES = 2;

  // Read and parse from conf (a standard parsed CIN).
  self.cname = conf.cname || name;
  self.ename = conf.ename || name;
  self.keyname = conf.keyname || [];  // upper-cased.
  self.table = conf.chardef || {}; // upper-cased.
  self.selkey = conf.selkey || []; // probably also upper-cased.
  self.max_keystroke = parseInt(conf.max_keystroke || "0");
  self.endkey = conf.endkey || "";
  self.opts = {};

  // jscin gen_input v1
  if (conf.SELKEY_SHIFT) {
    self.opts.OPT_SELKEY_SHIFT = true;
    self.selkey = ' ' + self.selkey;
  }

  // gcin
  switch (parseInt(conf.space_style || "-1")) {
    case 1:
      // Boshiamy, Dayi
      self.opts.OPT_SPACE_COMMIT_ON_ANY = true;
      break;

    case 2:
      // Simplex.
      self.opts.OPT_SPACE_COMMIT_ON_FULL = true;
      break;

    case 4:
      // Windows Array30, Changjei.
      self.opts.OPT_SPACE_COMMIT_NORMAL = true;
      break;

    case 8:
      // Dayi: input:2, select:1 (?)
      self.opts.OPT_SPACE_COMMIT_DAYI = true;
      break;

    case -1:
      break;

    default:
      trace("unknown space_style: ", conf.space_style);
      break;
  }
}

GenInp2.prototype.new_instance = function(ctx) {
  var self = new Object();
  var conf = this;

  // Initialize context.
  ResetContext(ctx);

  function ResultError(ctx) {
    NotifyError(ctx);
    return jscin.IMKEY_ABSORB;
  }

  function ResultProcessed(ctx) {
    return jscin.IMKEY_ABSORB;
  }

  function ResultIgnored(ctx) {
    return jscin.IMKEY_IGNORE;
  }

  function ResultCommit(ctx) {
    return jscin.IMKEY_COMMIT;
  }

  function ResetContext(ctx) {
    trace(ctx);
    ctx.state = conf.STATE_COMPOSITION;
    ctx.composition = '';
    ctx.candidates = [];
    ctx.commit = '';
    ctx.display_composition = '';
    ctx.candidates_start_index = 0;

    // Compatible with gen_inp.
    ctx.selkey = conf.selkey;
    ctx.keystroke = '';
    ctx.mcch = '';
    ctx.cch = '';
  }

  function UpdateCandidates(ctx) {
    trace(ctx);
    // Compatible with gen_inp.
    ctx.mcch = ctx.candidates.substr(
        ctx.candidates_start_index, conf.selkey.length);
  }

  function UpdateComposition(ctx) {
    trace(ctx.composition);
    ctx.display_composition = '';
    for (var i = 0; i < ctx.composition.length; i++) {
      var c = ctx.composition[i].toUpperCase()
      ctx.display_composition += conf.keyname[c] || c;
    }
    // Compatible with gen_inp.
    ctx.keystroke = ctx.display_composition;
  }

  function ShiftState(ctx) {
    trace(ctx.state);
    switch (ctx.state) {
      case conf.STATE_COMPOSITION:
        ctx.state = conf.STATE_CANDIDATES;
        ctx.candidates_start_index = 0;
        break;
      case conf.STATE_CANDIDATES:
        ctx.state = conf.STATE_COMPOSITION;
        ctx.candidates_start_index = 0;
        break;
    }
  }

  function IsSingleCandidate(ctx) {
    return ctx.candidates.length == 1;
  }

  function CanCycleCandidates(ctx) {
    return ctx.candidates.length > conf.selkey.length;
  }

  function CycleCandidates(ctx, direction) {
    trace(ctx, direction);
    if (!CanCycleCandidates(ctx))
      return false;
    direction = direction || 1;
    var max = ctx.candidates.length;
    var cycle_size = conf.selkey.length;
    var new_index = ctx.candidates_start_index + direction * cycle_size;
    if (new_index >= max) {
      new_index = 0;
    } else if (new_index < 0) {
      new_index = max - (max % cycle_size);
    }
    trace('old index: ' + ctx.candidates_start_index +
          ", new index: " + new_index);
    ctx.candidates_start_index = new_index;
    UpdateCandidates(ctx);
    return true;
  }

  function PrepareCandidates(ctx) {
    trace(ctx.composition);
    // TODO(hungte) Currently cin_parser concats everything into a big string,
    // so candidates is a string. We should make it into an array.
    ctx.candidates = conf.table[ctx.composition.toUpperCase()] || '';
    UpdateCandidates(ctx);
    return ctx.candidates.length > 0;
  }

  function IsCompositionKey(ctx, key) {
    return key.toUpperCase() in conf.keyname;
  }

  function IsEmptyComposition(ctx) {
    return ctx.composition.length == 0;
  }

  function IsEmptyCandidates(ctx) {
    return ctx.candidates.length == 0;
  }

  function AddComposition(ctx, key) {
    trace(ctx, key);
    if (conf.max_keystroke &&
        ctx.composition.length >= conf.max_keystroke)
      return false;
    ctx.composition += key;
    UpdateComposition(ctx);
    PrepareCandidates(ctx);
    return true;
  }

  function DelComposition(ctx) {
    trace(ctx);
    if (!ctx.composition.length)
      return false;
    ctx.composition = ctx.composition.replace(/.$/, '');
    UpdateComposition(ctx);
    PrepareCandidates(ctx);
    UpdateCandidates(ctx);
    return true;
  }

  function CommitText(ctx, candidate_index) {
    trace(ctx.candidates, candidate_index);
    candidate_index = candidate_index || 0;
    if (ctx.candidates.length < candidate_index)
      return false;

    var text = ctx.candidates[candidate_index];
    ResetContext(ctx);
    ctx.commit = text;
    trace('COMMIT=', ctx.commit);
    // Compatible with gen_inp.
    ctx.cch = text;
    return true;
  }

  function IsSelectionKey(ctx, key) {
    return conf.selkey.indexOf(key.toUpperCase()) >= 0;
  }

  function IsEndKey(ctx, key) {
    return conf.endkey && conf.endkey.indexOf(key.toUpperCase()) >= 0;
  }

  function SelectCommit(ctx, key) {
    trace(ctx, key);
    var index = (ctx.candidates_start_index +
                 conf.selkey.indexOf(key.toUpperCase()));
    return CommitText(ctx, index);
  }

  function NotifyError(ctx) {
    trace('BEEP');
    // beep.
  }

  function ProcessCompositionStateKey(ctx, key) {
    if (IsEndKey(ctx, key)) {
      trace('IsEndKey', key);
      AddComposition(ctx, key);
      key = ' ';
    }

    switch (key) {
      case 'Backspace':
        if (!DelComposition(ctx))
          return ResultIgnored(ctx);
        return ResultProcessed(ctx);

      case 'Esc':
        if (IsEmptyComposition(ctx))
          return ResultIgnored(ctx);
        ResetContext(ctx);
        return ResultProcessed(ctx);

      case ' ':
        if (IsEmptyComposition(ctx))
          return ResultIgnored(ctx);
        if (!PrepareCandidates(ctx)) {
          return ResultError(ctx);
        }
        ShiftState(ctx);
        if (IsSingleCandidate(ctx)) {
          CommitText(ctx, 0);
          return ResultCommit(ctx);
        }
        return ResultProcessed(ctx);

      default:
        if (!IsCompositionKey(ctx, key)) {
          if (IsSelectionKey(ctx, key) && !IsEmptyCandidates(ctx)) {
            if (SelectCommit(ctx, key))
              return ResultCommit(ctx);
            return ResultError(ctx);
          }
          return ResultIgnored(ctx);
        }

        if (AddComposition(ctx, key))
          return ResultProcessed(ctx);
        return ResultError(ctx);
    }
    return ResultIgnored(ctx);
  }

  function ProcessCandidatesStateKey(ctx, key) {
    switch (key) {
      case 'Esc':
        ResetContext(ctx);
        return ResultProcessed(ctx);

      case 'Backspace':
        ShiftState(ctx);
        DelComposition(ctx);
        return ResultProcessed(ctx);

      case 'Left':
      case 'PageUp':
      case 'Up':
        CycleCandidates(ctx, -1);
        return ResultProcessed(ctx);

      case 'Right':
      case 'PageDown':
      case 'Down':
        CycleCandidates(ctx);
        return ResultProcessed(ctx);

      case ' ':
        if (!CycleCandidates(ctx)) {
          CommitText(ctx, 0);
          return ResultCommit(ctx);
        }
        return ResultProcessed(ctx);

      default:
        if (IsSelectionKey(ctx, key)) {
          if (SelectCommit(ctx, key))
            return ResultCommit(ctx);
          return ResultError(ctx);
        }
        if (IsCompositionKey(ctx, key)) {
          CommitText(ctx, 0);
          AddComposition(ctx, key);
          return ResultCommit(ctx);
        }
        break;
    }
  }

  self.onKeystroke = function(ctx, ev) {
    trace(ev);
    if (ev.type != 'keydown' || ev.ctrlKey || ev.altKey || ev.shiftKey)
      return ResultIgnored(ctx);

    switch (ctx.state) {
      case conf.STATE_COMPOSITION:
        return ProcessCompositionStateKey(ctx, ev.key);
      case conf.STATE_CANDIDATES:
        return ProcessCandidatesStateKey(ctx, ev.key);
    }
    return ResultIgnored(ctx);
  }

  // ------------------------------------------------
  return self;
}

// Entry stub
jscin.register_module('GenInp', GenInp2);
jscin.debug = true;

