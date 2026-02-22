// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = import.meta.require;

// node_modules/grammy/out/filter.js
var require_filter = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.matchFilter = matchFilter;
  exports.parse = parse;
  exports.preprocess = preprocess;
  var filterQueryCache = new Map;
  function matchFilter(filter) {
    var _a;
    const queries = Array.isArray(filter) ? filter : [filter];
    const key = queries.join(",");
    const predicate = (_a = filterQueryCache.get(key)) !== null && _a !== undefined ? _a : (() => {
      const parsed = parse(queries);
      const pred = compile(parsed);
      filterQueryCache.set(key, pred);
      return pred;
    })();
    return (ctx) => predicate(ctx);
  }
  function parse(filter) {
    return Array.isArray(filter) ? filter.map((q) => q.split(":")) : [filter.split(":")];
  }
  function compile(parsed) {
    const preprocessed = parsed.flatMap((q) => check(q, preprocess(q)));
    const ltree = treeify(preprocessed);
    const predicate = arborist(ltree);
    return (ctx) => !!predicate(ctx.update, ctx);
  }
  function preprocess(filter) {
    const valid = UPDATE_KEYS;
    const expanded = [filter].flatMap((q) => {
      const [l1, l2, l3] = q;
      if (!(l1 in L1_SHORTCUTS))
        return [q];
      if (!l1 && !l2 && !l3)
        return [q];
      const targets = L1_SHORTCUTS[l1];
      const expanded2 = targets.map((s) => [s, l2, l3]);
      if (l2 === undefined)
        return expanded2;
      if (l2 in L2_SHORTCUTS && (l2 || l3))
        return expanded2;
      return expanded2.filter(([s]) => {
        var _a;
        return !!((_a = valid[s]) === null || _a === undefined ? undefined : _a[l2]);
      });
    }).flatMap((q) => {
      const [l1, l2, l3] = q;
      if (!(l2 in L2_SHORTCUTS))
        return [q];
      if (!l2 && !l3)
        return [q];
      const targets = L2_SHORTCUTS[l2];
      const expanded2 = targets.map((s) => [l1, s, l3]);
      if (l3 === undefined)
        return expanded2;
      return expanded2.filter(([, s]) => {
        var _a, _b;
        return !!((_b = (_a = valid[l1]) === null || _a === undefined ? undefined : _a[s]) === null || _b === undefined ? undefined : _b[l3]);
      });
    });
    if (expanded.length === 0) {
      throw new Error(`Shortcuts in '${filter.join(":")}' do not expand to any valid filter query`);
    }
    return expanded;
  }
  function check(original, preprocessed) {
    if (preprocessed.length === 0)
      throw new Error("Empty filter query given");
    const errors = preprocessed.map(checkOne).filter((r) => r !== true);
    if (errors.length === 0)
      return preprocessed;
    else if (errors.length === 1)
      throw new Error(errors[0]);
    else {
      throw new Error(`Invalid filter query '${original.join(":")}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join("; ")}`);
    }
  }
  function checkOne(filter) {
    const [l1, l2, l3, ...n] = filter;
    if (l1 === undefined)
      return "Empty filter query given";
    if (!(l1 in UPDATE_KEYS)) {
      const permitted = Object.keys(UPDATE_KEYS);
      return `Invalid L1 filter '${l1}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l2 === undefined)
      return true;
    const l1Obj = UPDATE_KEYS[l1];
    if (!(l2 in l1Obj)) {
      const permitted = Object.keys(l1Obj);
      return `Invalid L2 filter '${l2}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l3 === undefined)
      return true;
    const l2Obj = l1Obj[l2];
    if (!(l3 in l2Obj)) {
      const permitted = Object.keys(l2Obj);
      return `Invalid L3 filter '${l3}' given in '${filter.join(":")}'. ${permitted.length === 0 ? `No further filtering is possible after '${l1}:${l2}'.` : `Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`}`;
    }
    if (n.length === 0)
      return true;
    return `Cannot filter further than three levels, ':${n.join(":")}' is invalid!`;
  }
  function treeify(paths) {
    var _a, _b;
    const tree = {};
    for (const [l1, l2, l3] of paths) {
      const subtree = (_a = tree[l1]) !== null && _a !== undefined ? _a : tree[l1] = {};
      if (l2 !== undefined) {
        const set = (_b = subtree[l2]) !== null && _b !== undefined ? _b : subtree[l2] = new Set;
        if (l3 !== undefined)
          set.add(l3);
      }
    }
    return tree;
  }
  function or(left, right) {
    return (obj, ctx) => left(obj, ctx) || right(obj, ctx);
  }
  function concat(get, test) {
    return (obj, ctx) => {
      const nextObj = get(obj, ctx);
      return nextObj && test(nextObj, ctx);
    };
  }
  function leaf(pred) {
    return (obj, ctx) => pred(obj, ctx) != null;
  }
  function arborist(tree) {
    const l1Predicates = Object.entries(tree).map(([l1, subtree]) => {
      const l1Pred = (obj) => obj[l1];
      const l2Predicates = Object.entries(subtree).map(([l2, set]) => {
        const l2Pred = (obj) => obj[l2];
        const l3Predicates = Array.from(set).map((l3) => {
          const l3Pred = l3 === "me" ? (obj, ctx) => {
            const me = ctx.me.id;
            return testMaybeArray(obj, (u) => u.id === me);
          } : (obj) => testMaybeArray(obj, (e) => e[l3] || e.type === l3);
          return l3Pred;
        });
        return l3Predicates.length === 0 ? leaf(l2Pred) : concat(l2Pred, l3Predicates.reduce(or));
      });
      return l2Predicates.length === 0 ? leaf(l1Pred) : concat(l1Pred, l2Predicates.reduce(or));
    });
    if (l1Predicates.length === 0) {
      throw new Error("Cannot create filter function for empty query");
    }
    return l1Predicates.reduce(or);
  }
  function testMaybeArray(t, pred) {
    const p = (x) => x != null && pred(x);
    return Array.isArray(t) ? t.some(p) : p(t);
  }
  var ENTITY_KEYS = {
    mention: {},
    hashtag: {},
    cashtag: {},
    bot_command: {},
    url: {},
    email: {},
    phone_number: {},
    bold: {},
    italic: {},
    underline: {},
    strikethrough: {},
    spoiler: {},
    blockquote: {},
    expandable_blockquote: {},
    code: {},
    pre: {},
    text_link: {},
    text_mention: {},
    custom_emoji: {}
  };
  var USER_KEYS = {
    me: {},
    is_bot: {},
    is_premium: {},
    added_to_attachment_menu: {}
  };
  var FORWARD_ORIGIN_KEYS = {
    user: {},
    hidden_user: {},
    chat: {},
    channel: {}
  };
  var STICKER_KEYS = {
    is_video: {},
    is_animated: {},
    premium_animation: {}
  };
  var REACTION_KEYS = {
    emoji: {},
    custom_emoji: {},
    paid: {}
  };
  var GIFT_INFO_KEYS = {
    can_be_upgraded: {},
    is_upgrade_separate: {},
    is_private: {}
  };
  var COMMON_MESSAGE_KEYS = {
    forward_origin: FORWARD_ORIGIN_KEYS,
    is_topic_message: {},
    is_automatic_forward: {},
    business_connection_id: {},
    text: {},
    animation: {},
    audio: {},
    document: {},
    paid_media: {},
    photo: {},
    sticker: STICKER_KEYS,
    story: {},
    video: {},
    video_note: {},
    voice: {},
    contact: {},
    dice: {},
    game: {},
    poll: {},
    venue: {},
    location: {},
    entities: ENTITY_KEYS,
    caption_entities: ENTITY_KEYS,
    caption: {},
    link_preview_options: {
      url: {},
      prefer_small_media: {},
      prefer_large_media: {},
      show_above_text: {}
    },
    effect_id: {},
    paid_star_count: {},
    has_media_spoiler: {},
    new_chat_title: {},
    new_chat_photo: {},
    delete_chat_photo: {},
    message_auto_delete_timer_changed: {},
    pinned_message: {},
    invoice: {},
    proximity_alert_triggered: {},
    chat_background_set: {},
    giveaway_created: {},
    giveaway: { only_new_members: {}, has_public_winners: {} },
    giveaway_winners: { only_new_members: {}, was_refunded: {} },
    giveaway_completed: {},
    gift: GIFT_INFO_KEYS,
    gift_upgrade_sent: GIFT_INFO_KEYS,
    unique_gift: { transfer_star_count: {} },
    paid_message_price_changed: {},
    video_chat_scheduled: {},
    video_chat_started: {},
    video_chat_ended: {},
    video_chat_participants_invited: {},
    web_app_data: {}
  };
  var MESSAGE_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    direct_messages_topic: {},
    chat_owner_left: { new_owner: {} },
    chat_owner_changd: {},
    new_chat_members: USER_KEYS,
    left_chat_member: USER_KEYS,
    group_chat_created: {},
    supergroup_chat_created: {},
    migrate_to_chat_id: {},
    migrate_from_chat_id: {},
    successful_payment: {},
    refunded_payment: {},
    users_shared: {},
    chat_shared: {},
    connected_website: {},
    write_access_allowed: {},
    passport_data: {},
    boost_added: {},
    forum_topic_created: { is_name_implicit: {} },
    forum_topic_edited: { name: {}, icon_custom_emoji_id: {} },
    forum_topic_closed: {},
    forum_topic_reopened: {},
    general_forum_topic_hidden: {},
    general_forum_topic_unhidden: {},
    checklist: { others_can_add_tasks: {}, others_can_mark_tasks_as_done: {} },
    checklist_tasks_done: {},
    checklist_tasks_added: {},
    suggested_post_info: {},
    suggested_post_approved: {},
    suggested_post_approval_failed: {},
    suggested_post_declined: {},
    suggested_post_paid: {},
    suggested_post_refunded: {},
    sender_boost_count: {}
  };
  var CHANNEL_POST_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    channel_chat_created: {},
    direct_message_price_changed: {},
    is_paid_post: {}
  };
  var BUSINESS_CONNECTION_KEYS = {
    can_reply: {},
    is_enabled: {}
  };
  var MESSAGE_REACTION_KEYS = {
    old_reaction: REACTION_KEYS,
    new_reaction: REACTION_KEYS
  };
  var MESSAGE_REACTION_COUNT_UPDATED_KEYS = {
    reactions: REACTION_KEYS
  };
  var CALLBACK_QUERY_KEYS = { data: {}, game_short_name: {} };
  var CHAT_MEMBER_UPDATED_KEYS = { from: USER_KEYS };
  var UPDATE_KEYS = {
    message: MESSAGE_KEYS,
    edited_message: MESSAGE_KEYS,
    channel_post: CHANNEL_POST_KEYS,
    edited_channel_post: CHANNEL_POST_KEYS,
    business_connection: BUSINESS_CONNECTION_KEYS,
    business_message: MESSAGE_KEYS,
    edited_business_message: MESSAGE_KEYS,
    deleted_business_messages: {},
    inline_query: {},
    chosen_inline_result: {},
    callback_query: CALLBACK_QUERY_KEYS,
    shipping_query: {},
    pre_checkout_query: {},
    poll: {},
    poll_answer: {},
    my_chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_join_request: {},
    message_reaction: MESSAGE_REACTION_KEYS,
    message_reaction_count: MESSAGE_REACTION_COUNT_UPDATED_KEYS,
    chat_boost: {},
    removed_chat_boost: {},
    purchased_paid_media: {}
  };
  var L1_SHORTCUTS = {
    "": ["message", "channel_post"],
    msg: ["message", "channel_post"],
    edit: ["edited_message", "edited_channel_post"]
  };
  var L2_SHORTCUTS = {
    "": ["entities", "caption_entities"],
    media: ["photo", "video"],
    file: [
      "photo",
      "animation",
      "audio",
      "document",
      "video",
      "video_note",
      "voice",
      "sticker"
    ]
  };
});

// node_modules/grammy/out/context.js
var require_context = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Context = undefined;
  var filter_js_1 = require_filter();
  var checker = {
    filterQuery(filter) {
      const pred = (0, filter_js_1.matchFilter)(filter);
      return (ctx) => pred(ctx);
    },
    text(trigger) {
      const hasText = checker.filterQuery([":text", ":caption"]);
      const trg = triggerFn(trigger);
      return (ctx) => {
        var _a, _b;
        if (!hasText(ctx))
          return false;
        const msg = (_a = ctx.message) !== null && _a !== undefined ? _a : ctx.channelPost;
        const txt = (_b = msg.text) !== null && _b !== undefined ? _b : msg.caption;
        return match(ctx, txt, trg);
      };
    },
    command(command) {
      const hasEntities = checker.filterQuery(":entities:bot_command");
      const atCommands = new Set;
      const noAtCommands = new Set;
      toArray(command).forEach((cmd) => {
        if (cmd.startsWith("/")) {
          throw new Error(`Do not include '/' when registering command handlers (use '${cmd.substring(1)}' not '${cmd}')`);
        }
        const set = cmd.includes("@") ? atCommands : noAtCommands;
        set.add(cmd);
      });
      return (ctx) => {
        var _a, _b;
        if (!hasEntities(ctx))
          return false;
        const msg = (_a = ctx.message) !== null && _a !== undefined ? _a : ctx.channelPost;
        const txt = (_b = msg.text) !== null && _b !== undefined ? _b : msg.caption;
        return msg.entities.some((e) => {
          if (e.type !== "bot_command")
            return false;
          if (e.offset !== 0)
            return false;
          const cmd = txt.substring(1, e.length);
          if (noAtCommands.has(cmd) || atCommands.has(cmd)) {
            ctx.match = txt.substring(cmd.length + 1).trimStart();
            return true;
          }
          const index = cmd.indexOf("@");
          if (index === -1)
            return false;
          const atTarget = cmd.substring(index + 1).toLowerCase();
          const username = ctx.me.username.toLowerCase();
          if (atTarget !== username)
            return false;
          const atCommand = cmd.substring(0, index);
          if (noAtCommands.has(atCommand)) {
            ctx.match = txt.substring(cmd.length + 1).trimStart();
            return true;
          }
          return false;
        });
      };
    },
    reaction(reaction) {
      const hasMessageReaction = checker.filterQuery("message_reaction");
      const normalized = typeof reaction === "string" ? [{ type: "emoji", emoji: reaction }] : (Array.isArray(reaction) ? reaction : [reaction]).map((emoji2) => typeof emoji2 === "string" ? { type: "emoji", emoji: emoji2 } : emoji2);
      const emoji = new Set(normalized.filter((r) => r.type === "emoji").map((r) => r.emoji));
      const customEmoji = new Set(normalized.filter((r) => r.type === "custom_emoji").map((r) => r.custom_emoji_id));
      const paid = normalized.some((r) => r.type === "paid");
      return (ctx) => {
        if (!hasMessageReaction(ctx))
          return false;
        const { old_reaction, new_reaction } = ctx.messageReaction;
        for (const reaction2 of new_reaction) {
          let isOld = false;
          if (reaction2.type === "emoji") {
            for (const old of old_reaction) {
              if (old.type !== "emoji")
                continue;
              if (old.emoji === reaction2.emoji) {
                isOld = true;
                break;
              }
            }
          } else if (reaction2.type === "custom_emoji") {
            for (const old of old_reaction) {
              if (old.type !== "custom_emoji")
                continue;
              if (old.custom_emoji_id === reaction2.custom_emoji_id) {
                isOld = true;
                break;
              }
            }
          } else if (reaction2.type === "paid") {
            for (const old of old_reaction) {
              if (old.type !== "paid")
                continue;
              isOld = true;
              break;
            }
          } else {}
          if (isOld)
            continue;
          if (reaction2.type === "emoji") {
            if (emoji.has(reaction2.emoji))
              return true;
          } else if (reaction2.type === "custom_emoji") {
            if (customEmoji.has(reaction2.custom_emoji_id))
              return true;
          } else if (reaction2.type === "paid") {
            if (paid)
              return true;
          } else {
            return true;
          }
        }
        return false;
      };
    },
    chatType(chatType) {
      const set = new Set(toArray(chatType));
      return (ctx) => {
        var _a;
        return ((_a = ctx.chat) === null || _a === undefined ? undefined : _a.type) !== undefined && set.has(ctx.chat.type);
      };
    },
    callbackQuery(trigger) {
      const hasCallbackQuery = checker.filterQuery("callback_query:data");
      const trg = triggerFn(trigger);
      return (ctx) => hasCallbackQuery(ctx) && match(ctx, ctx.callbackQuery.data, trg);
    },
    gameQuery(trigger) {
      const hasGameQuery = checker.filterQuery("callback_query:game_short_name");
      const trg = triggerFn(trigger);
      return (ctx) => hasGameQuery(ctx) && match(ctx, ctx.callbackQuery.game_short_name, trg);
    },
    inlineQuery(trigger) {
      const hasInlineQuery = checker.filterQuery("inline_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasInlineQuery(ctx) && match(ctx, ctx.inlineQuery.query, trg);
    },
    chosenInlineResult(trigger) {
      const hasChosenInlineResult = checker.filterQuery("chosen_inline_result");
      const trg = triggerFn(trigger);
      return (ctx) => hasChosenInlineResult(ctx) && match(ctx, ctx.chosenInlineResult.result_id, trg);
    },
    preCheckoutQuery(trigger) {
      const hasPreCheckoutQuery = checker.filterQuery("pre_checkout_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasPreCheckoutQuery(ctx) && match(ctx, ctx.preCheckoutQuery.invoice_payload, trg);
    },
    shippingQuery(trigger) {
      const hasShippingQuery = checker.filterQuery("shipping_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasShippingQuery(ctx) && match(ctx, ctx.shippingQuery.invoice_payload, trg);
    }
  };

  class Context {
    constructor(update, api, me) {
      this.update = update;
      this.api = api;
      this.me = me;
    }
    get message() {
      return this.update.message;
    }
    get editedMessage() {
      return this.update.edited_message;
    }
    get channelPost() {
      return this.update.channel_post;
    }
    get editedChannelPost() {
      return this.update.edited_channel_post;
    }
    get businessConnection() {
      return this.update.business_connection;
    }
    get businessMessage() {
      return this.update.business_message;
    }
    get editedBusinessMessage() {
      return this.update.edited_business_message;
    }
    get deletedBusinessMessages() {
      return this.update.deleted_business_messages;
    }
    get messageReaction() {
      return this.update.message_reaction;
    }
    get messageReactionCount() {
      return this.update.message_reaction_count;
    }
    get inlineQuery() {
      return this.update.inline_query;
    }
    get chosenInlineResult() {
      return this.update.chosen_inline_result;
    }
    get callbackQuery() {
      return this.update.callback_query;
    }
    get shippingQuery() {
      return this.update.shipping_query;
    }
    get preCheckoutQuery() {
      return this.update.pre_checkout_query;
    }
    get poll() {
      return this.update.poll;
    }
    get pollAnswer() {
      return this.update.poll_answer;
    }
    get myChatMember() {
      return this.update.my_chat_member;
    }
    get chatMember() {
      return this.update.chat_member;
    }
    get chatJoinRequest() {
      return this.update.chat_join_request;
    }
    get chatBoost() {
      return this.update.chat_boost;
    }
    get removedChatBoost() {
      return this.update.removed_chat_boost;
    }
    get purchasedPaidMedia() {
      return this.update.purchased_paid_media;
    }
    get msg() {
      var _a, _b, _c, _d, _e, _f, _g;
      return (_f = (_e = (_d = (_c = (_b = (_a = this.message) !== null && _a !== undefined ? _a : this.editedMessage) !== null && _b !== undefined ? _b : this.channelPost) !== null && _c !== undefined ? _c : this.editedChannelPost) !== null && _d !== undefined ? _d : this.businessMessage) !== null && _e !== undefined ? _e : this.editedBusinessMessage) !== null && _f !== undefined ? _f : (_g = this.callbackQuery) === null || _g === undefined ? undefined : _g.message;
    }
    get chat() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j;
      return (_j = (_h = (_g = (_f = (_e = (_d = (_c = (_b = (_a = this.msg) !== null && _a !== undefined ? _a : this.deletedBusinessMessages) !== null && _b !== undefined ? _b : this.messageReaction) !== null && _c !== undefined ? _c : this.messageReactionCount) !== null && _d !== undefined ? _d : this.myChatMember) !== null && _e !== undefined ? _e : this.chatMember) !== null && _f !== undefined ? _f : this.chatJoinRequest) !== null && _g !== undefined ? _g : this.chatBoost) !== null && _h !== undefined ? _h : this.removedChatBoost) === null || _j === undefined ? undefined : _j.chat;
    }
    get senderChat() {
      var _a;
      return (_a = this.msg) === null || _a === undefined ? undefined : _a.sender_chat;
    }
    get from() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
      return (_g = (_f = (_b = (_a = this.businessConnection) !== null && _a !== undefined ? _a : this.messageReaction) !== null && _b !== undefined ? _b : (_e = (_d = (_c = this.chatBoost) === null || _c === undefined ? undefined : _c.boost) !== null && _d !== undefined ? _d : this.removedChatBoost) === null || _e === undefined ? undefined : _e.source) === null || _f === undefined ? undefined : _f.user) !== null && _g !== undefined ? _g : (_s = (_r = (_q = (_p = (_o = (_m = (_l = (_k = (_j = (_h = this.callbackQuery) !== null && _h !== undefined ? _h : this.msg) !== null && _j !== undefined ? _j : this.inlineQuery) !== null && _k !== undefined ? _k : this.chosenInlineResult) !== null && _l !== undefined ? _l : this.shippingQuery) !== null && _m !== undefined ? _m : this.preCheckoutQuery) !== null && _o !== undefined ? _o : this.myChatMember) !== null && _p !== undefined ? _p : this.chatMember) !== null && _q !== undefined ? _q : this.chatJoinRequest) !== null && _r !== undefined ? _r : this.purchasedPaidMedia) === null || _s === undefined ? undefined : _s.from;
    }
    get msgId() {
      var _a, _b, _c, _d, _e;
      return (_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id;
    }
    get chatId() {
      var _a, _b, _c;
      return (_b = (_a = this.chat) === null || _a === undefined ? undefined : _a.id) !== null && _b !== undefined ? _b : (_c = this.businessConnection) === null || _c === undefined ? undefined : _c.user_chat_id;
    }
    get inlineMessageId() {
      var _a, _b, _c;
      return (_b = (_a = this.callbackQuery) === null || _a === undefined ? undefined : _a.inline_message_id) !== null && _b !== undefined ? _b : (_c = this.chosenInlineResult) === null || _c === undefined ? undefined : _c.inline_message_id;
    }
    get businessConnectionId() {
      var _a, _b, _c, _d, _e;
      return (_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.business_connection_id) !== null && _b !== undefined ? _b : (_c = this.businessConnection) === null || _c === undefined ? undefined : _c.id) !== null && _d !== undefined ? _d : (_e = this.deletedBusinessMessages) === null || _e === undefined ? undefined : _e.business_connection_id;
    }
    entities(types) {
      var _a, _b;
      const message = this.msg;
      if (message === undefined)
        return [];
      const text = (_a = message.text) !== null && _a !== undefined ? _a : message.caption;
      if (text === undefined)
        return [];
      let entities = (_b = message.entities) !== null && _b !== undefined ? _b : message.caption_entities;
      if (entities === undefined)
        return [];
      if (types !== undefined) {
        const filters = new Set(toArray(types));
        entities = entities.filter((entity) => filters.has(entity.type));
      }
      return entities.map((entity) => ({
        ...entity,
        text: text.substring(entity.offset, entity.offset + entity.length)
      }));
    }
    reactions() {
      const emoji = [];
      const emojiAdded = [];
      const emojiKept = [];
      const emojiRemoved = [];
      const customEmoji = [];
      const customEmojiAdded = [];
      const customEmojiKept = [];
      const customEmojiRemoved = [];
      let paid = false;
      let paidAdded = false;
      const r = this.messageReaction;
      if (r !== undefined) {
        const { old_reaction, new_reaction } = r;
        for (const reaction of new_reaction) {
          if (reaction.type === "emoji") {
            emoji.push(reaction.emoji);
          } else if (reaction.type === "custom_emoji") {
            customEmoji.push(reaction.custom_emoji_id);
          } else if (reaction.type === "paid") {
            paid = paidAdded = true;
          }
        }
        for (const reaction of old_reaction) {
          if (reaction.type === "emoji") {
            emojiRemoved.push(reaction.emoji);
          } else if (reaction.type === "custom_emoji") {
            customEmojiRemoved.push(reaction.custom_emoji_id);
          } else if (reaction.type === "paid") {
            paidAdded = false;
          }
        }
        emojiAdded.push(...emoji);
        customEmojiAdded.push(...customEmoji);
        for (let i = 0;i < emojiRemoved.length; i++) {
          const len = emojiAdded.length;
          if (len === 0)
            break;
          const rem = emojiRemoved[i];
          for (let j = 0;j < len; j++) {
            if (rem === emojiAdded[j]) {
              emojiKept.push(rem);
              emojiRemoved.splice(i, 1);
              emojiAdded.splice(j, 1);
              i--;
              break;
            }
          }
        }
        for (let i = 0;i < customEmojiRemoved.length; i++) {
          const len = customEmojiAdded.length;
          if (len === 0)
            break;
          const rem = customEmojiRemoved[i];
          for (let j = 0;j < len; j++) {
            if (rem === customEmojiAdded[j]) {
              customEmojiKept.push(rem);
              customEmojiRemoved.splice(i, 1);
              customEmojiAdded.splice(j, 1);
              i--;
              break;
            }
          }
        }
      }
      return {
        emoji,
        emojiAdded,
        emojiKept,
        emojiRemoved,
        customEmoji,
        customEmojiAdded,
        customEmojiKept,
        customEmojiRemoved,
        paid,
        paidAdded
      };
    }
    has(filter) {
      return Context.has.filterQuery(filter)(this);
    }
    hasText(trigger) {
      return Context.has.text(trigger)(this);
    }
    hasCommand(command) {
      return Context.has.command(command)(this);
    }
    hasReaction(reaction) {
      return Context.has.reaction(reaction)(this);
    }
    hasChatType(chatType) {
      return Context.has.chatType(chatType)(this);
    }
    hasCallbackQuery(trigger) {
      return Context.has.callbackQuery(trigger)(this);
    }
    hasGameQuery(trigger) {
      return Context.has.gameQuery(trigger)(this);
    }
    hasInlineQuery(trigger) {
      return Context.has.inlineQuery(trigger)(this);
    }
    hasChosenInlineResult(trigger) {
      return Context.has.chosenInlineResult(trigger)(this);
    }
    hasPreCheckoutQuery(trigger) {
      return Context.has.preCheckoutQuery(trigger)(this);
    }
    hasShippingQuery(trigger) {
      return Context.has.shippingQuery(trigger)(this);
    }
    reply(text, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendMessage(orThrow(this.chatId, "sendMessage"), text, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithDraft(text, other, signal) {
      const msg = this.msg;
      return this.api.sendMessageDraft(orThrow(this.chatId, "sendMessageDraft"), this.update.update_id, text, {
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg === null || msg === undefined ? undefined : msg.message_thread_id } : {},
        ...other
      }, signal);
    }
    forwardMessage(chat_id, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.forwardMessage(chat_id, orThrow(this.chatId, "forwardMessage"), orThrow(this.msgId, "forwardMessage"), {
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    forwardMessages(chat_id, message_ids, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.forwardMessages(chat_id, orThrow(this.chatId, "forwardMessages"), message_ids, {
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    copyMessage(chat_id, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.copyMessage(chat_id, orThrow(this.chatId, "copyMessage"), orThrow(this.msgId, "copyMessage"), {
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    copyMessages(chat_id, message_ids, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.copyMessages(chat_id, orThrow(this.chatId, "copyMessages"), message_ids, {
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithPhoto(photo, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendPhoto(orThrow(this.chatId, "sendPhoto"), photo, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithAudio(audio, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendAudio(orThrow(this.chatId, "sendAudio"), audio, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithDocument(document2, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendDocument(orThrow(this.chatId, "sendDocument"), document2, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithVideo(video, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendVideo(orThrow(this.chatId, "sendVideo"), video, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithAnimation(animation, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendAnimation(orThrow(this.chatId, "sendAnimation"), animation, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithVoice(voice, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendVoice(orThrow(this.chatId, "sendVoice"), voice, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithVideoNote(video_note, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendVideoNote(orThrow(this.chatId, "sendVideoNote"), video_note, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithMediaGroup(media, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendMediaGroup(orThrow(this.chatId, "sendMediaGroup"), media, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithLocation(latitude, longitude, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendLocation(orThrow(this.chatId, "sendLocation"), latitude, longitude, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    editMessageLiveLocation(latitude, longitude, other, signal) {
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageLiveLocationInline(inlineId, latitude, longitude, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.editMessageLiveLocation(orThrow(this.chatId, "editMessageLiveLocation"), orThrow(this.msgId, "editMessageLiveLocation"), latitude, longitude, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    stopMessageLiveLocation(other, signal) {
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.stopMessageLiveLocationInline(inlineId, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.stopMessageLiveLocation(orThrow(this.chatId, "stopMessageLiveLocation"), orThrow(this.msgId, "stopMessageLiveLocation"), { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    sendPaidMedia(star_count, media, other, signal) {
      var _a, _b;
      const msg = this.msg;
      return this.api.sendPaidMedia(orThrow(this.chatId, "sendPaidMedia"), star_count, media, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.direct_messages_topic) === null || _b === undefined ? undefined : _b.topic_id,
        ...other
      }, signal);
    }
    replyWithVenue(latitude, longitude, title, address, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendVenue(orThrow(this.chatId, "sendVenue"), latitude, longitude, title, address, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithContact(phone_number, first_name, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendContact(orThrow(this.chatId, "sendContact"), phone_number, first_name, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithPoll(question, options, other, signal) {
      const msg = this.msg;
      return this.api.sendPoll(orThrow(this.chatId, "sendPoll"), question, options, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        ...other
      }, signal);
    }
    replyWithChecklist(checklist, other, signal) {
      return this.api.sendChecklist(orThrow(this.businessConnectionId, "sendChecklist"), orThrow(this.chatId, "sendChecklist"), checklist, other, signal);
    }
    editMessageChecklist(checklist, other, signal) {
      var _a, _b, _c, _d;
      const msg = orThrow(this.msg, "editMessageChecklist");
      const target = (_d = (_b = (_a = msg.checklist_tasks_done) === null || _a === undefined ? undefined : _a.checklist_message) !== null && _b !== undefined ? _b : (_c = msg.checklist_tasks_added) === null || _c === undefined ? undefined : _c.checklist_message) !== null && _d !== undefined ? _d : msg;
      return this.api.editMessageChecklist(orThrow(this.businessConnectionId, "editMessageChecklist"), orThrow(target.chat.id, "editMessageChecklist"), orThrow(target.message_id, "editMessageChecklist"), checklist, other, signal);
    }
    replyWithDice(emoji, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendDice(orThrow(this.chatId, "sendDice"), emoji, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    replyWithChatAction(action, other, signal) {
      const msg = this.msg;
      return this.api.sendChatAction(orThrow(this.chatId, "sendChatAction"), action, {
        business_connection_id: this.businessConnectionId,
        message_thread_id: msg === null || msg === undefined ? undefined : msg.message_thread_id,
        ...other
      }, signal);
    }
    react(reaction, other, signal) {
      return this.api.setMessageReaction(orThrow(this.chatId, "setMessageReaction"), orThrow(this.msgId, "setMessageReaction"), typeof reaction === "string" ? [{ type: "emoji", emoji: reaction }] : (Array.isArray(reaction) ? reaction : [reaction]).map((emoji) => typeof emoji === "string" ? { type: "emoji", emoji } : emoji), other, signal);
    }
    getUserProfilePhotos(other, signal) {
      return this.api.getUserProfilePhotos(orThrow(this.from, "getUserProfilePhotos").id, other, signal);
    }
    getUserProfileAudios(other, signal) {
      return this.api.getUserProfileAudios(orThrow(this.from, "getUserProfileAudios").id, other, signal);
    }
    setUserEmojiStatus(other, signal) {
      return this.api.setUserEmojiStatus(orThrow(this.from, "setUserEmojiStatus").id, other, signal);
    }
    getUserChatBoosts(chat_id, signal) {
      return this.api.getUserChatBoosts(chat_id !== null && chat_id !== undefined ? chat_id : orThrow(this.chatId, "getUserChatBoosts"), orThrow(this.from, "getUserChatBoosts").id, signal);
    }
    getUserGifts(other, signal) {
      return this.api.getUserGifts(orThrow(this.from, "getUserGifts").id, other, signal);
    }
    getChatGifts(other, signal) {
      return this.api.getChatGifts(orThrow(this.chatId, "getChatGifts"), other, signal);
    }
    getBusinessConnection(signal) {
      return this.api.getBusinessConnection(orThrow(this.businessConnectionId, "getBusinessConnection"), signal);
    }
    getFile(signal) {
      var _a, _b, _c, _d, _e, _f;
      const m = orThrow(this.msg, "getFile");
      const file = m.photo !== undefined ? m.photo[m.photo.length - 1] : (_f = (_e = (_d = (_c = (_b = (_a = m.animation) !== null && _a !== undefined ? _a : m.audio) !== null && _b !== undefined ? _b : m.document) !== null && _c !== undefined ? _c : m.video) !== null && _d !== undefined ? _d : m.video_note) !== null && _e !== undefined ? _e : m.voice) !== null && _f !== undefined ? _f : m.sticker;
      return this.api.getFile(orThrow(file, "getFile").file_id, signal);
    }
    kickAuthor(...args) {
      return this.banAuthor(...args);
    }
    banAuthor(other, signal) {
      return this.api.banChatMember(orThrow(this.chatId, "banAuthor"), orThrow(this.from, "banAuthor").id, other, signal);
    }
    kickChatMember(...args) {
      return this.banChatMember(...args);
    }
    banChatMember(user_id, other, signal) {
      return this.api.banChatMember(orThrow(this.chatId, "banChatMember"), user_id, other, signal);
    }
    unbanChatMember(user_id, other, signal) {
      return this.api.unbanChatMember(orThrow(this.chatId, "unbanChatMember"), user_id, other, signal);
    }
    restrictAuthor(permissions, other, signal) {
      return this.api.restrictChatMember(orThrow(this.chatId, "restrictAuthor"), orThrow(this.from, "restrictAuthor").id, permissions, other, signal);
    }
    restrictChatMember(user_id, permissions, other, signal) {
      return this.api.restrictChatMember(orThrow(this.chatId, "restrictChatMember"), user_id, permissions, other, signal);
    }
    promoteAuthor(other, signal) {
      return this.api.promoteChatMember(orThrow(this.chatId, "promoteAuthor"), orThrow(this.from, "promoteAuthor").id, other, signal);
    }
    promoteChatMember(user_id, other, signal) {
      return this.api.promoteChatMember(orThrow(this.chatId, "promoteChatMember"), user_id, other, signal);
    }
    setChatAdministratorAuthorCustomTitle(custom_title, signal) {
      return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorAuthorCustomTitle"), orThrow(this.from, "setChatAdministratorAuthorCustomTitle").id, custom_title, signal);
    }
    setChatAdministratorCustomTitle(user_id, custom_title, signal) {
      return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorCustomTitle"), user_id, custom_title, signal);
    }
    banChatSenderChat(sender_chat_id, signal) {
      return this.api.banChatSenderChat(orThrow(this.chatId, "banChatSenderChat"), sender_chat_id, signal);
    }
    unbanChatSenderChat(sender_chat_id, signal) {
      return this.api.unbanChatSenderChat(orThrow(this.chatId, "unbanChatSenderChat"), sender_chat_id, signal);
    }
    setChatPermissions(permissions, other, signal) {
      return this.api.setChatPermissions(orThrow(this.chatId, "setChatPermissions"), permissions, other, signal);
    }
    exportChatInviteLink(signal) {
      return this.api.exportChatInviteLink(orThrow(this.chatId, "exportChatInviteLink"), signal);
    }
    createChatInviteLink(other, signal) {
      return this.api.createChatInviteLink(orThrow(this.chatId, "createChatInviteLink"), other, signal);
    }
    editChatInviteLink(invite_link, other, signal) {
      return this.api.editChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, other, signal);
    }
    createChatSubscriptionInviteLink(subscription_period, subscription_price, other, signal) {
      return this.api.createChatSubscriptionInviteLink(orThrow(this.chatId, "createChatSubscriptionInviteLink"), subscription_period, subscription_price, other, signal);
    }
    editChatSubscriptionInviteLink(invite_link, other, signal) {
      return this.api.editChatSubscriptionInviteLink(orThrow(this.chatId, "editChatSubscriptionInviteLink"), invite_link, other, signal);
    }
    revokeChatInviteLink(invite_link, signal) {
      return this.api.revokeChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, signal);
    }
    approveChatJoinRequest(user_id, signal) {
      return this.api.approveChatJoinRequest(orThrow(this.chatId, "approveChatJoinRequest"), user_id, signal);
    }
    declineChatJoinRequest(user_id, signal) {
      return this.api.declineChatJoinRequest(orThrow(this.chatId, "declineChatJoinRequest"), user_id, signal);
    }
    approveSuggestedPost(other, signal) {
      return this.api.approveSuggestedPost(orThrow(this.chatId, "approveSuggestedPost"), orThrow(this.msgId, "approveSuggestedPost"), other, signal);
    }
    declineSuggestedPost(other, signal) {
      return this.api.declineSuggestedPost(orThrow(this.chatId, "declineSuggestedPost"), orThrow(this.msgId, "declineSuggestedPost"), other, signal);
    }
    setChatPhoto(photo, signal) {
      return this.api.setChatPhoto(orThrow(this.chatId, "setChatPhoto"), photo, signal);
    }
    deleteChatPhoto(signal) {
      return this.api.deleteChatPhoto(orThrow(this.chatId, "deleteChatPhoto"), signal);
    }
    setChatTitle(title, signal) {
      return this.api.setChatTitle(orThrow(this.chatId, "setChatTitle"), title, signal);
    }
    setChatDescription(description, signal) {
      return this.api.setChatDescription(orThrow(this.chatId, "setChatDescription"), description, signal);
    }
    pinChatMessage(message_id, other, signal) {
      return this.api.pinChatMessage(orThrow(this.chatId, "pinChatMessage"), message_id, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    unpinChatMessage(message_id, other, signal) {
      return this.api.unpinChatMessage(orThrow(this.chatId, "unpinChatMessage"), message_id, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    unpinAllChatMessages(signal) {
      return this.api.unpinAllChatMessages(orThrow(this.chatId, "unpinAllChatMessages"), signal);
    }
    leaveChat(signal) {
      return this.api.leaveChat(orThrow(this.chatId, "leaveChat"), signal);
    }
    getChat(signal) {
      return this.api.getChat(orThrow(this.chatId, "getChat"), signal);
    }
    getChatAdministrators(signal) {
      return this.api.getChatAdministrators(orThrow(this.chatId, "getChatAdministrators"), signal);
    }
    getChatMembersCount(...args) {
      return this.getChatMemberCount(...args);
    }
    getChatMemberCount(signal) {
      return this.api.getChatMemberCount(orThrow(this.chatId, "getChatMemberCount"), signal);
    }
    getAuthor(signal) {
      return this.api.getChatMember(orThrow(this.chatId, "getAuthor"), orThrow(this.from, "getAuthor").id, signal);
    }
    getChatMember(user_id, signal) {
      return this.api.getChatMember(orThrow(this.chatId, "getChatMember"), user_id, signal);
    }
    setChatStickerSet(sticker_set_name, signal) {
      return this.api.setChatStickerSet(orThrow(this.chatId, "setChatStickerSet"), sticker_set_name, signal);
    }
    deleteChatStickerSet(signal) {
      return this.api.deleteChatStickerSet(orThrow(this.chatId, "deleteChatStickerSet"), signal);
    }
    createForumTopic(name, other, signal) {
      return this.api.createForumTopic(orThrow(this.chatId, "createForumTopic"), name, other, signal);
    }
    editForumTopic(other, signal) {
      const message = orThrow(this.msg, "editForumTopic");
      const thread = orThrow(message.message_thread_id, "editForumTopic");
      return this.api.editForumTopic(message.chat.id, thread, other, signal);
    }
    closeForumTopic(signal) {
      const message = orThrow(this.msg, "closeForumTopic");
      const thread = orThrow(message.message_thread_id, "closeForumTopic");
      return this.api.closeForumTopic(message.chat.id, thread, signal);
    }
    reopenForumTopic(signal) {
      const message = orThrow(this.msg, "reopenForumTopic");
      const thread = orThrow(message.message_thread_id, "reopenForumTopic");
      return this.api.reopenForumTopic(message.chat.id, thread, signal);
    }
    deleteForumTopic(signal) {
      const message = orThrow(this.msg, "deleteForumTopic");
      const thread = orThrow(message.message_thread_id, "deleteForumTopic");
      return this.api.deleteForumTopic(message.chat.id, thread, signal);
    }
    unpinAllForumTopicMessages(signal) {
      const message = orThrow(this.msg, "unpinAllForumTopicMessages");
      const thread = orThrow(message.message_thread_id, "unpinAllForumTopicMessages");
      return this.api.unpinAllForumTopicMessages(message.chat.id, thread, signal);
    }
    editGeneralForumTopic(name, signal) {
      return this.api.editGeneralForumTopic(orThrow(this.chatId, "editGeneralForumTopic"), name, signal);
    }
    closeGeneralForumTopic(signal) {
      return this.api.closeGeneralForumTopic(orThrow(this.chatId, "closeGeneralForumTopic"), signal);
    }
    reopenGeneralForumTopic(signal) {
      return this.api.reopenGeneralForumTopic(orThrow(this.chatId, "reopenGeneralForumTopic"), signal);
    }
    hideGeneralForumTopic(signal) {
      return this.api.hideGeneralForumTopic(orThrow(this.chatId, "hideGeneralForumTopic"), signal);
    }
    unhideGeneralForumTopic(signal) {
      return this.api.unhideGeneralForumTopic(orThrow(this.chatId, "unhideGeneralForumTopic"), signal);
    }
    unpinAllGeneralForumTopicMessages(signal) {
      return this.api.unpinAllGeneralForumTopicMessages(orThrow(this.chatId, "unpinAllGeneralForumTopicMessages"), signal);
    }
    answerCallbackQuery(other, signal) {
      return this.api.answerCallbackQuery(orThrow(this.callbackQuery, "answerCallbackQuery").id, typeof other === "string" ? { text: other } : other, signal);
    }
    setChatMenuButton(other, signal) {
      return this.api.setChatMenuButton(other, signal);
    }
    getChatMenuButton(other, signal) {
      return this.api.getChatMenuButton(other, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
      return this.api.setMyDefaultAdministratorRights(other, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
      return this.api.getMyDefaultAdministratorRights(other, signal);
    }
    editMessageText(text, other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageTextInline(inlineId, text, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.editMessageText(orThrow(this.chatId, "editMessageText"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageText"), text, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    editMessageCaption(other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageCaptionInline(inlineId, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.editMessageCaption(orThrow(this.chatId, "editMessageCaption"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageCaption"), { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    editMessageMedia(media, other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageMediaInline(inlineId, media, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.editMessageMedia(orThrow(this.chatId, "editMessageMedia"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageMedia"), media, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    editMessageReplyMarkup(other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageReplyMarkupInline(inlineId, { business_connection_id: this.businessConnectionId, ...other }, signal) : this.api.editMessageReplyMarkup(orThrow(this.chatId, "editMessageReplyMarkup"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageReplyMarkup"), { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    stopPoll(other, signal) {
      var _a, _b, _c, _d, _e;
      return this.api.stopPoll(orThrow(this.chatId, "stopPoll"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "stopPoll"), { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    deleteMessage(signal) {
      var _a, _b, _c, _d, _e;
      return this.api.deleteMessage(orThrow(this.chatId, "deleteMessage"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "deleteMessage"), signal);
    }
    deleteMessages(message_ids, signal) {
      return this.api.deleteMessages(orThrow(this.chatId, "deleteMessages"), message_ids, signal);
    }
    deleteBusinessMessages(message_ids, signal) {
      return this.api.deleteBusinessMessages(orThrow(this.businessConnectionId, "deleteBusinessMessages"), message_ids, signal);
    }
    setBusinessAccountName(first_name, other, signal) {
      return this.api.setBusinessAccountName(orThrow(this.businessConnectionId, "setBusinessAccountName"), first_name, other, signal);
    }
    setBusinessAccountUsername(username, signal) {
      return this.api.setBusinessAccountUsername(orThrow(this.businessConnectionId, "setBusinessAccountUsername"), username, signal);
    }
    setBusinessAccountBio(bio, signal) {
      return this.api.setBusinessAccountBio(orThrow(this.businessConnectionId, "setBusinessAccountBio"), bio, signal);
    }
    setBusinessAccountProfilePhoto(photo, other, signal) {
      return this.api.setBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "setBusinessAccountProfilePhoto"), photo, other, signal);
    }
    removeBusinessAccountProfilePhoto(other, signal) {
      return this.api.removeBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "removeBusinessAccountProfilePhoto"), other, signal);
    }
    setBusinessAccountGiftSettings(show_gift_button, accepted_gift_types, signal) {
      return this.api.setBusinessAccountGiftSettings(orThrow(this.businessConnectionId, "setBusinessAccountGiftSettings"), show_gift_button, accepted_gift_types, signal);
    }
    getBusinessAccountStarBalance(signal) {
      return this.api.getBusinessAccountStarBalance(orThrow(this.businessConnectionId, "getBusinessAccountStarBalance"), signal);
    }
    transferBusinessAccountStars(star_count, signal) {
      return this.api.transferBusinessAccountStars(orThrow(this.businessConnectionId, "transferBusinessAccountStars"), star_count, signal);
    }
    getBusinessAccountGifts(other, signal) {
      return this.api.getBusinessAccountGifts(orThrow(this.businessConnectionId, "getBusinessAccountGifts"), other, signal);
    }
    convertGiftToStars(owned_gift_id, signal) {
      return this.api.convertGiftToStars(orThrow(this.businessConnectionId, "convertGiftToStars"), owned_gift_id, signal);
    }
    upgradeGift(owned_gift_id, other, signal) {
      return this.api.upgradeGift(orThrow(this.businessConnectionId, "upgradeGift"), owned_gift_id, other, signal);
    }
    transferGift(owned_gift_id, new_owner_chat_id, star_count, signal) {
      return this.api.transferGift(orThrow(this.businessConnectionId, "transferGift"), owned_gift_id, new_owner_chat_id, star_count, signal);
    }
    postStory(content, active_period, other, signal) {
      return this.api.postStory(orThrow(this.businessConnectionId, "postStory"), content, active_period, other, signal);
    }
    repostStory(active_period, other, signal) {
      var _a;
      const story = orThrow((_a = this.msg) === null || _a === undefined ? undefined : _a.story, "repostStory");
      return this.api.repostStory(orThrow(this.businessConnectionId, "repostStory"), story.chat.id, story.id, active_period, other, signal);
    }
    editStory(story_id, content, other, signal) {
      return this.api.editStory(orThrow(this.businessConnectionId, "editStory"), story_id, content, other, signal);
    }
    deleteStory(story_id, signal) {
      return this.api.deleteStory(orThrow(this.businessConnectionId, "deleteStory"), story_id, signal);
    }
    replyWithSticker(sticker, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendSticker(orThrow(this.chatId, "sendSticker"), sticker, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    getCustomEmojiStickers(signal) {
      var _a, _b;
      return this.api.getCustomEmojiStickers(((_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.entities) !== null && _b !== undefined ? _b : []).filter((e) => e.type === "custom_emoji").map((e) => e.custom_emoji_id), signal);
    }
    replyWithGift(gift_id, other, signal) {
      return this.api.sendGift(orThrow(this.from, "sendGift").id, gift_id, other, signal);
    }
    giftPremiumSubscription(month_count, star_count, other, signal) {
      return this.api.giftPremiumSubscription(orThrow(this.from, "giftPremiumSubscription").id, month_count, star_count, other, signal);
    }
    replyWithGiftToChannel(gift_id, other, signal) {
      return this.api.sendGiftToChannel(orThrow(this.chat, "sendGift").id, gift_id, other, signal);
    }
    answerInlineQuery(results, other, signal) {
      return this.api.answerInlineQuery(orThrow(this.inlineQuery, "answerInlineQuery").id, results, other, signal);
    }
    savePreparedInlineMessage(result, other, signal) {
      return this.api.savePreparedInlineMessage(orThrow(this.from, "savePreparedInlineMessage").id, result, other, signal);
    }
    replyWithInvoice(title, description, payload, currency, prices, other, signal) {
      var _a;
      const msg = this.msg;
      return this.api.sendInvoice(orThrow(this.chatId, "sendInvoice"), title, description, payload, currency, prices, {
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        direct_messages_topic_id: (_a = msg === null || msg === undefined ? undefined : msg.direct_messages_topic) === null || _a === undefined ? undefined : _a.topic_id,
        ...other
      }, signal);
    }
    answerShippingQuery(ok, other, signal) {
      return this.api.answerShippingQuery(orThrow(this.shippingQuery, "answerShippingQuery").id, ok, other, signal);
    }
    answerPreCheckoutQuery(ok, other, signal) {
      return this.api.answerPreCheckoutQuery(orThrow(this.preCheckoutQuery, "answerPreCheckoutQuery").id, ok, typeof other === "string" ? { error_message: other } : other, signal);
    }
    refundStarPayment(signal) {
      var _a;
      return this.api.refundStarPayment(orThrow(this.from, "refundStarPayment").id, orThrow((_a = this.msg) === null || _a === undefined ? undefined : _a.successful_payment, "refundStarPayment").telegram_payment_charge_id, signal);
    }
    editUserStarSubscription(telegram_payment_charge_id, is_canceled, signal) {
      return this.api.editUserStarSubscription(orThrow(this.from, "editUserStarSubscription").id, telegram_payment_charge_id, is_canceled, signal);
    }
    verifyUser(other, signal) {
      return this.api.verifyUser(orThrow(this.from, "verifyUser").id, other, signal);
    }
    verifyChat(other, signal) {
      return this.api.verifyChat(orThrow(this.chatId, "verifyChat"), other, signal);
    }
    removeUserVerification(signal) {
      return this.api.removeUserVerification(orThrow(this.from, "removeUserVerification").id, signal);
    }
    removeChatVerification(signal) {
      return this.api.removeChatVerification(orThrow(this.chatId, "removeChatVerification"), signal);
    }
    readBusinessMessage(signal) {
      return this.api.readBusinessMessage(orThrow(this.businessConnectionId, "readBusinessMessage"), orThrow(this.chatId, "readBusinessMessage"), orThrow(this.msgId, "readBusinessMessage"), signal);
    }
    setPassportDataErrors(errors, signal) {
      return this.api.setPassportDataErrors(orThrow(this.from, "setPassportDataErrors").id, errors, signal);
    }
    replyWithGame(game_short_name, other, signal) {
      const msg = this.msg;
      return this.api.sendGame(orThrow(this.chatId, "sendGame"), game_short_name, {
        business_connection_id: this.businessConnectionId,
        ...(msg === null || msg === undefined ? undefined : msg.is_topic_message) ? { message_thread_id: msg.message_thread_id } : {},
        ...other
      }, signal);
    }
  }
  exports.Context = Context;
  Context.has = checker;
  function orThrow(value, method) {
    if (value === undefined) {
      throw new Error(`Missing information for API call to ${method}`);
    }
    return value;
  }
  function triggerFn(trigger) {
    return toArray(trigger).map((t) => typeof t === "string" ? (txt) => txt === t ? t : null : (txt) => txt.match(t));
  }
  function match(ctx, content, triggers) {
    for (const t of triggers) {
      const res = t(content);
      if (res) {
        ctx.match = res;
        return true;
      }
    }
    return false;
  }
  function toArray(e) {
    return Array.isArray(e) ? e : [e];
  }
});

// node_modules/grammy/out/composer.js
var require_composer = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Composer = exports.BotError = undefined;
  exports.run = run;
  var context_js_1 = require_context();

  class BotError extends Error {
    constructor(error, ctx) {
      super(generateBotErrorMessage(error));
      this.error = error;
      this.ctx = ctx;
      this.name = "BotError";
      if (error instanceof Error)
        this.stack = error.stack;
    }
  }
  exports.BotError = BotError;
  function generateBotErrorMessage(error) {
    let msg;
    if (error instanceof Error) {
      msg = `${error.name} in middleware: ${error.message}`;
    } else {
      const type = typeof error;
      msg = `Non-error value of type ${type} thrown in middleware`;
      switch (type) {
        case "bigint":
        case "boolean":
        case "number":
        case "symbol":
          msg += `: ${error}`;
          break;
        case "string":
          msg += `: ${String(error).substring(0, 50)}`;
          break;
        default:
          msg += "!";
          break;
      }
    }
    return msg;
  }
  function flatten(mw) {
    return typeof mw === "function" ? mw : (ctx, next) => mw.middleware()(ctx, next);
  }
  function concat(first, andThen) {
    return async (ctx, next) => {
      let nextCalled = false;
      await first(ctx, async () => {
        if (nextCalled)
          throw new Error("`next` already called before!");
        else
          nextCalled = true;
        await andThen(ctx, next);
      });
    };
  }
  function pass(_ctx, next) {
    return next();
  }
  var leaf = () => Promise.resolve();
  async function run(middleware, ctx) {
    await middleware(ctx, leaf);
  }

  class Composer {
    constructor(...middleware) {
      this.handler = middleware.length === 0 ? pass : middleware.map(flatten).reduce(concat);
    }
    middleware() {
      return this.handler;
    }
    use(...middleware) {
      const composer = new Composer(...middleware);
      this.handler = concat(this.handler, flatten(composer));
      return composer;
    }
    on(filter, ...middleware) {
      return this.filter(context_js_1.Context.has.filterQuery(filter), ...middleware);
    }
    hears(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.text(trigger), ...middleware);
    }
    command(command, ...middleware) {
      return this.filter(context_js_1.Context.has.command(command), ...middleware);
    }
    reaction(reaction, ...middleware) {
      return this.filter(context_js_1.Context.has.reaction(reaction), ...middleware);
    }
    chatType(chatType, ...middleware) {
      return this.filter(context_js_1.Context.has.chatType(chatType), ...middleware);
    }
    callbackQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.callbackQuery(trigger), ...middleware);
    }
    gameQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.gameQuery(trigger), ...middleware);
    }
    inlineQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.inlineQuery(trigger), ...middleware);
    }
    chosenInlineResult(resultId, ...middleware) {
      return this.filter(context_js_1.Context.has.chosenInlineResult(resultId), ...middleware);
    }
    preCheckoutQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.preCheckoutQuery(trigger), ...middleware);
    }
    shippingQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.shippingQuery(trigger), ...middleware);
    }
    filter(predicate, ...middleware) {
      const composer = new Composer(...middleware);
      this.branch(predicate, composer, pass);
      return composer;
    }
    drop(predicate, ...middleware) {
      return this.filter(async (ctx) => !await predicate(ctx), ...middleware);
    }
    fork(...middleware) {
      const composer = new Composer(...middleware);
      const fork = flatten(composer);
      this.use((ctx, next) => Promise.all([next(), run(fork, ctx)]));
      return composer;
    }
    lazy(middlewareFactory) {
      return this.use(async (ctx, next) => {
        const middleware = await middlewareFactory(ctx);
        const arr = Array.isArray(middleware) ? middleware : [middleware];
        await flatten(new Composer(...arr))(ctx, next);
      });
    }
    route(router, routeHandlers, fallback = pass) {
      return this.lazy(async (ctx) => {
        var _a;
        const route = await router(ctx);
        return (_a = route === undefined || !routeHandlers[route] ? fallback : routeHandlers[route]) !== null && _a !== undefined ? _a : [];
      });
    }
    branch(predicate, trueMiddleware, falseMiddleware) {
      return this.lazy(async (ctx) => await predicate(ctx) ? trueMiddleware : falseMiddleware);
    }
    errorBoundary(errorHandler, ...middleware) {
      const composer = new Composer(...middleware);
      const bound = flatten(composer);
      this.use(async (ctx, next) => {
        let nextCalled = false;
        const cont = () => (nextCalled = true, Promise.resolve());
        try {
          await bound(ctx, cont);
        } catch (err) {
          nextCalled = false;
          await errorHandler(new BotError(err, ctx), cont);
        }
        if (nextCalled)
          await next();
      });
      return composer;
    }
  }
  exports.Composer = Composer;
});

// node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/debug/src/node.js
var require_node = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = (()=>{throw new Error("Cannot require module "+"supports-color");})();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
  };
});

// node_modules/debug/src/index.js
var require_src = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser();
  } else {
    module.exports = require_node();
  }
});

// node_modules/grammy/out/platform.node.js
var require_platform_node = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.defaultAdapter = exports.itrToStream = exports.debug = undefined;
  exports.baseFetchConfig = baseFetchConfig;
  var http_1 = __require("http");
  var https_1 = __require("https");
  var stream_1 = __require("stream");
  var debug_1 = require_src();
  Object.defineProperty(exports, "debug", { enumerable: true, get: function() {
    return debug_1.debug;
  } });
  var itrToStream = (itr) => stream_1.Readable.from(itr, { objectMode: false });
  exports.itrToStream = itrToStream;
  var httpAgents = new Map;
  var httpsAgents = new Map;
  function getCached(map, key, otherwise) {
    let value = map.get(key);
    if (value === undefined) {
      value = otherwise();
      map.set(key, value);
    }
    return value;
  }
  function baseFetchConfig(apiRoot) {
    if (apiRoot.startsWith("https:")) {
      return {
        compress: true,
        agent: getCached(httpsAgents, apiRoot, () => new https_1.Agent({ keepAlive: true }))
      };
    } else if (apiRoot.startsWith("http:")) {
      return {
        agent: getCached(httpAgents, apiRoot, () => new http_1.Agent({ keepAlive: true }))
      };
    } else
      return {};
  }
  exports.defaultAdapter = "express";
});

// node_modules/grammy/out/core/error.js
var require_error = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.HttpError = exports.GrammyError = undefined;
  exports.toGrammyError = toGrammyError;
  exports.toHttpError = toHttpError;
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:warn");

  class GrammyError extends Error {
    constructor(message, err, method, payload) {
      var _a;
      super(`${message} (${err.error_code}: ${err.description})`);
      this.method = method;
      this.payload = payload;
      this.ok = false;
      this.name = "GrammyError";
      this.error_code = err.error_code;
      this.description = err.description;
      this.parameters = (_a = err.parameters) !== null && _a !== undefined ? _a : {};
    }
  }
  exports.GrammyError = GrammyError;
  function toGrammyError(err, method, payload) {
    switch (err.error_code) {
      case 401:
        debug("Error 401 means that your bot token is wrong, talk to https://t.me/BotFather to check it.");
        break;
      case 409:
        debug("Error 409 means that you are running your bot several times on long polling. Consider revoking the bot token if you believe that no other instance is running.");
        break;
    }
    return new GrammyError(`Call to '${method}' failed!`, err, method, payload);
  }

  class HttpError extends Error {
    constructor(message, error) {
      super(message);
      this.error = error;
      this.name = "HttpError";
    }
  }
  exports.HttpError = HttpError;
  function isTelegramError(err) {
    return typeof err === "object" && err !== null && "status" in err && "statusText" in err;
  }
  function toHttpError(method, sensitiveLogs) {
    return (err) => {
      let msg = `Network request for '${method}' failed!`;
      if (isTelegramError(err))
        msg += ` (${err.status}: ${err.statusText})`;
      if (sensitiveLogs && err instanceof Error)
        msg += ` ${err.message}`;
      throw new HttpError(msg, err);
    };
  }
});

// node_modules/@grammyjs/types/mod.js
var exports_mod = {};

// node_modules/grammy/out/types.node.js
var require_types_node = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InputFile = undefined;
  var fs_1 = __require("fs");
  var node_fetch_1 = __require("node-fetch");
  var path_1 = __require("path");
  var platform_node_1 = require_platform_node();
  var debug = (0, platform_node_1.debug)("grammy:warn");
  __exportStar(__toCommonJS(exports_mod), exports);

  class InputFile {
    constructor(file, filename) {
      this.consumed = false;
      this.fileData = file;
      filename !== null && filename !== undefined || (filename = this.guessFilename(file));
      this.filename = filename;
      if (typeof file === "string" && (file.startsWith("http:") || file.startsWith("https:"))) {
        debug(`InputFile received the local file path '${file}' that looks like a URL. Is this a mistake?`);
      }
    }
    guessFilename(file) {
      if (typeof file === "string")
        return (0, path_1.basename)(file);
      if ("url" in file)
        return (0, path_1.basename)(file.url);
      if (!(file instanceof URL))
        return;
      if (file.pathname !== "/") {
        const filename = (0, path_1.basename)(file.pathname);
        if (filename)
          return filename;
      }
      return (0, path_1.basename)(file.hostname);
    }
    async toRaw() {
      if (this.consumed) {
        throw new Error("Cannot reuse InputFile data source!");
      }
      const data = this.fileData;
      if (typeof data === "string")
        return (0, fs_1.createReadStream)(data);
      if (data instanceof URL) {
        return data.protocol === "file" ? (0, fs_1.createReadStream)(data.pathname) : fetchFile(data);
      }
      if ("url" in data)
        return fetchFile(data.url);
      if (data instanceof Uint8Array)
        return data;
      if (typeof data === "function") {
        return new InputFile(await data()).toRaw();
      }
      this.consumed = true;
      return data;
    }
    toJSON() {
      throw new Error("InputFile instances must be sent via grammY");
    }
  }
  exports.InputFile = InputFile;
  async function* fetchFile(url) {
    const { body } = await (0, node_fetch_1.default)(url);
    for await (const chunk of body) {
      if (typeof chunk === "string") {
        throw new Error(`Could not transfer file, received string data instead of bytes from '${url}'`);
      }
      yield chunk;
    }
  }
});

// node_modules/grammy/out/types.js
var require_types = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  __exportStar(require_types_node(), exports);
});

// node_modules/grammy/out/core/payload.js
var require_payload = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.requiresFormDataUpload = requiresFormDataUpload;
  exports.createJsonPayload = createJsonPayload;
  exports.createFormDataPayload = createFormDataPayload;
  var platform_node_js_1 = require_platform_node();
  var types_js_1 = require_types();
  function requiresFormDataUpload(payload) {
    return payload instanceof types_js_1.InputFile || typeof payload === "object" && payload !== null && Object.values(payload).some((v) => Array.isArray(v) ? v.some(requiresFormDataUpload) : v instanceof types_js_1.InputFile || requiresFormDataUpload(v));
  }
  function str(value) {
    return JSON.stringify(value, (_, v) => v !== null && v !== undefined ? v : undefined);
  }
  function createJsonPayload(payload) {
    return {
      method: "POST",
      headers: {
        "content-type": "application/json",
        connection: "keep-alive"
      },
      body: str(payload)
    };
  }
  async function* protectItr(itr, onError) {
    try {
      yield* itr;
    } catch (err) {
      onError(err);
    }
  }
  function createFormDataPayload(payload, onError) {
    const boundary = createBoundary();
    const itr = payloadToMultipartItr(payload, boundary);
    const safeItr = protectItr(itr, onError);
    const stream = (0, platform_node_js_1.itrToStream)(safeItr);
    return {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        connection: "keep-alive"
      },
      body: stream
    };
  }
  function createBoundary() {
    return "----------" + randomId(32);
  }
  function randomId(length = 16) {
    return Array.from(Array(length)).map(() => Math.random().toString(36)[2] || 0).join("");
  }
  var enc = new TextEncoder;
  async function* payloadToMultipartItr(payload, boundary) {
    const files = collectFiles(payload);
    yield enc.encode(`--${boundary}\r
`);
    const separator = enc.encode(`\r
--${boundary}\r
`);
    let first = true;
    for (const [key, value] of Object.entries(payload)) {
      if (value == null)
        continue;
      if (!first)
        yield separator;
      yield valuePart(key, value instanceof types_js_1.InputFile ? value.toJSON() : typeof value === "object" ? str(value) : value);
      first = false;
    }
    for (const { id, origin, file } of files) {
      if (!first)
        yield separator;
      yield* filePart(id, origin, file);
      first = false;
    }
    yield enc.encode(`\r
--${boundary}--\r
`);
  }
  function collectFiles(value) {
    if (typeof value !== "object" || value === null)
      return [];
    return Object.entries(value).flatMap(([k, v]) => {
      if (Array.isArray(v))
        return v.flatMap((p) => collectFiles(p));
      else if (v instanceof types_js_1.InputFile) {
        const id = randomId();
        Object.assign(v, { toJSON: () => `attach://${id}` });
        const origin = k === "media" && "type" in value && typeof value.type === "string" ? value.type : k;
        return { id, origin, file: v };
      } else
        return collectFiles(v);
    });
  }
  function valuePart(key, value) {
    return enc.encode(`content-disposition:form-data;name="${key}"\r
\r
${value}`);
  }
  async function* filePart(id, origin, input) {
    const filename = input.filename || `${origin}.${getExt(origin)}`;
    if (filename.includes("\r") || filename.includes(`
`)) {
      throw new Error(`File paths cannot contain carriage-return (\\r) or newline (\\n) characters! Filename for property '${origin}' was:
"""
${filename}
"""`);
    }
    yield enc.encode(`content-disposition:form-data;name="${id}";filename=${filename}\r
content-type:application/octet-stream\r
\r
`);
    const data = await input.toRaw();
    if (data instanceof Uint8Array)
      yield data;
    else
      yield* data;
  }
  function getExt(key) {
    switch (key) {
      case "certificate":
        return "pem";
      case "photo":
      case "thumbnail":
        return "jpg";
      case "voice":
        return "ogg";
      case "audio":
        return "mp3";
      case "animation":
      case "video":
      case "video_note":
        return "mp4";
      case "sticker":
        return "webp";
      default:
        return "dat";
    }
  }
});

// node_modules/grammy/out/shim.node.js
var require_shim_node = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.fetch = exports.AbortController = undefined;
  var abort_controller_1 = __require("abort-controller");
  Object.defineProperty(exports, "AbortController", { enumerable: true, get: function() {
    return abort_controller_1.AbortController;
  } });
  var node_fetch_1 = __require("node-fetch");
  Object.defineProperty(exports, "fetch", { enumerable: true, get: function() {
    return node_fetch_1.default;
  } });
});

// node_modules/grammy/out/core/client.js
var require_client = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createRawApi = createRawApi;
  var platform_node_js_1 = require_platform_node();
  var error_js_1 = require_error();
  var payload_js_1 = require_payload();
  var debug = (0, platform_node_js_1.debug)("grammy:core");
  function concatTransformer(prev, trans) {
    return (method, payload, signal) => trans(prev, method, payload, signal);
  }

  class ApiClient {
    constructor(token, options = {}, webhookReplyEnvelope = {}) {
      var _a, _b, _c, _d, _e, _f;
      this.token = token;
      this.webhookReplyEnvelope = webhookReplyEnvelope;
      this.hasUsedWebhookReply = false;
      this.installedTransformers = [];
      this.call = async (method, p, signal) => {
        const payload = p !== null && p !== undefined ? p : {};
        debug(`Calling ${method}`);
        if (signal !== undefined)
          validateSignal(method, payload, signal);
        const opts = this.options;
        const formDataRequired = (0, payload_js_1.requiresFormDataUpload)(payload);
        if (this.webhookReplyEnvelope.send !== undefined && !this.hasUsedWebhookReply && !formDataRequired && opts.canUseWebhookReply(method)) {
          this.hasUsedWebhookReply = true;
          const config2 = (0, payload_js_1.createJsonPayload)({ ...payload, method });
          await this.webhookReplyEnvelope.send(config2.body);
          return { ok: true, result: true };
        }
        const controller = createAbortControllerFromSignal(signal);
        const timeout = createTimeout(controller, opts.timeoutSeconds, method);
        const streamErr = createStreamError(controller);
        const url = opts.buildUrl(opts.apiRoot, this.token, method, opts.environment);
        const config = formDataRequired ? (0, payload_js_1.createFormDataPayload)(payload, (err) => streamErr.catch(err)) : (0, payload_js_1.createJsonPayload)(payload);
        const sig = controller.signal;
        const options2 = { ...opts.baseFetchConfig, signal: sig, ...config };
        const successPromise = this.fetch(url instanceof URL ? url.href : url, options2).catch((0, error_js_1.toHttpError)(method, opts.sensitiveLogs));
        const operations = [successPromise, streamErr.promise, timeout.promise];
        try {
          const res = await Promise.race(operations);
          return await res.json();
        } finally {
          if (timeout.handle !== undefined)
            clearTimeout(timeout.handle);
        }
      };
      const apiRoot = (_a = options.apiRoot) !== null && _a !== undefined ? _a : "https://api.telegram.org";
      const environment = (_b = options.environment) !== null && _b !== undefined ? _b : "prod";
      const { fetch: customFetch } = options;
      const fetchFn = customFetch !== null && customFetch !== undefined ? customFetch : shim_node_js_1.fetch;
      this.options = {
        apiRoot,
        environment,
        buildUrl: (_c = options.buildUrl) !== null && _c !== undefined ? _c : defaultBuildUrl,
        timeoutSeconds: (_d = options.timeoutSeconds) !== null && _d !== undefined ? _d : 500,
        baseFetchConfig: {
          ...(0, platform_node_js_1.baseFetchConfig)(apiRoot),
          ...options.baseFetchConfig
        },
        canUseWebhookReply: (_e = options.canUseWebhookReply) !== null && _e !== undefined ? _e : () => false,
        sensitiveLogs: (_f = options.sensitiveLogs) !== null && _f !== undefined ? _f : false,
        fetch: (...args) => fetchFn(...args)
      };
      this.fetch = this.options.fetch;
      if (this.options.apiRoot.endsWith("/")) {
        throw new Error(`Remove the trailing '/' from the 'apiRoot' option (use '${this.options.apiRoot.substring(0, this.options.apiRoot.length - 1)}' instead of '${this.options.apiRoot}')`);
      }
    }
    use(...transformers) {
      this.call = transformers.reduce(concatTransformer, this.call);
      this.installedTransformers.push(...transformers);
      return this;
    }
    async callApi(method, payload, signal) {
      const data = await this.call(method, payload, signal);
      if (data.ok)
        return data.result;
      else
        throw (0, error_js_1.toGrammyError)(data, method, payload);
    }
  }
  function createRawApi(token, options, webhookReplyEnvelope) {
    const client = new ApiClient(token, options, webhookReplyEnvelope);
    const proxyHandler = {
      get(_, m) {
        return m === "toJSON" ? "__internal" : m === "getMe" || m === "getWebhookInfo" || m === "getForumTopicIconStickers" || m === "getAvailableGifts" || m === "logOut" || m === "close" || m === "getMyStarBalance" || m === "removeMyProfilePhoto" ? client.callApi.bind(client, m, {}) : client.callApi.bind(client, m);
      },
      ...proxyMethods
    };
    const raw = new Proxy({}, proxyHandler);
    const installedTransformers = client.installedTransformers;
    const api = {
      raw,
      installedTransformers,
      use: (...t) => {
        client.use(...t);
        return api;
      }
    };
    return api;
  }
  var defaultBuildUrl = (root, token, method, env) => {
    const prefix = env === "test" ? "test/" : "";
    return `${root}/bot${token}/${prefix}${method}`;
  };
  var proxyMethods = {
    set() {
      return false;
    },
    defineProperty() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    ownKeys() {
      return [];
    }
  };
  function createTimeout(controller, seconds, method) {
    let handle = undefined;
    const promise = new Promise((_, reject) => {
      handle = setTimeout(() => {
        const msg = `Request to '${method}' timed out after ${seconds} seconds`;
        reject(new Error(msg));
        controller.abort();
      }, 1000 * seconds);
    });
    return { promise, handle };
  }
  function createStreamError(abortController) {
    let onError = (err) => {
      throw err;
    };
    const promise = new Promise((_, reject) => {
      onError = (err) => {
        reject(err);
        abortController.abort();
      };
    });
    return { promise, catch: onError };
  }
  function createAbortControllerFromSignal(signal) {
    const abortController = new shim_node_js_1.AbortController;
    if (signal === undefined)
      return abortController;
    const sig = signal;
    function abort() {
      abortController.abort();
      sig.removeEventListener("abort", abort);
    }
    if (sig.aborted)
      abort();
    else
      sig.addEventListener("abort", abort);
    return { abort, signal: abortController.signal };
  }
  function validateSignal(method, payload, signal) {
    if (typeof (signal === null || signal === undefined ? undefined : signal.addEventListener) === "function") {
      return;
    }
    let payload0 = JSON.stringify(payload);
    if (payload0.length > 20) {
      payload0 = payload0.substring(0, 16) + " ...";
    }
    let payload1 = JSON.stringify(signal);
    if (payload1.length > 20) {
      payload1 = payload1.substring(0, 16) + " ...";
    }
    throw new Error(`Incorrect abort signal instance found! You passed two payloads to '${method}' but you should merge the second one containing '${payload1}' into the first one containing '${payload0}'! If you are using context shortcuts, you may want to use a method on 'ctx.api' instead.

If you want to prevent such mistakes in the future, consider using TypeScript. https://www.typescriptlang.org/`);
  }
  var shim_node_js_1 = require_shim_node();
});

// node_modules/grammy/out/core/api.js
var require_api = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Api = undefined;
  var client_js_1 = require_client();

  class Api {
    constructor(token, options, webhookReplyEnvelope) {
      this.token = token;
      this.options = options;
      const { raw, use, installedTransformers } = (0, client_js_1.createRawApi)(token, options, webhookReplyEnvelope);
      this.raw = raw;
      this.config = {
        use,
        installedTransformers: () => installedTransformers.slice()
      };
    }
    getUpdates(other, signal) {
      return this.raw.getUpdates({ ...other }, signal);
    }
    setWebhook(url, other, signal) {
      return this.raw.setWebhook({ url, ...other }, signal);
    }
    deleteWebhook(other, signal) {
      return this.raw.deleteWebhook({ ...other }, signal);
    }
    getWebhookInfo(signal) {
      return this.raw.getWebhookInfo(signal);
    }
    getMe(signal) {
      return this.raw.getMe(signal);
    }
    logOut(signal) {
      return this.raw.logOut(signal);
    }
    close(signal) {
      return this.raw.close(signal);
    }
    sendMessage(chat_id, text, other, signal) {
      return this.raw.sendMessage({ chat_id, text, ...other }, signal);
    }
    sendMessageDraft(chat_id, draft_id, text, other, signal) {
      return this.raw.sendMessageDraft({ chat_id, draft_id, text, ...other }, signal);
    }
    forwardMessage(chat_id, from_chat_id, message_id, other, signal) {
      return this.raw.forwardMessage({ chat_id, from_chat_id, message_id, ...other }, signal);
    }
    forwardMessages(chat_id, from_chat_id, message_ids, other, signal) {
      return this.raw.forwardMessages({
        chat_id,
        from_chat_id,
        message_ids,
        ...other
      }, signal);
    }
    copyMessage(chat_id, from_chat_id, message_id, other, signal) {
      return this.raw.copyMessage({ chat_id, from_chat_id, message_id, ...other }, signal);
    }
    copyMessages(chat_id, from_chat_id, message_ids, other, signal) {
      return this.raw.copyMessages({
        chat_id,
        from_chat_id,
        message_ids,
        ...other
      }, signal);
    }
    sendPhoto(chat_id, photo, other, signal) {
      return this.raw.sendPhoto({ chat_id, photo, ...other }, signal);
    }
    sendAudio(chat_id, audio, other, signal) {
      return this.raw.sendAudio({ chat_id, audio, ...other }, signal);
    }
    sendDocument(chat_id, document2, other, signal) {
      return this.raw.sendDocument({ chat_id, document: document2, ...other }, signal);
    }
    sendVideo(chat_id, video, other, signal) {
      return this.raw.sendVideo({ chat_id, video, ...other }, signal);
    }
    sendAnimation(chat_id, animation, other, signal) {
      return this.raw.sendAnimation({ chat_id, animation, ...other }, signal);
    }
    sendVoice(chat_id, voice, other, signal) {
      return this.raw.sendVoice({ chat_id, voice, ...other }, signal);
    }
    sendVideoNote(chat_id, video_note, other, signal) {
      return this.raw.sendVideoNote({ chat_id, video_note, ...other }, signal);
    }
    sendMediaGroup(chat_id, media, other, signal) {
      return this.raw.sendMediaGroup({ chat_id, media, ...other }, signal);
    }
    sendLocation(chat_id, latitude, longitude, other, signal) {
      return this.raw.sendLocation({ chat_id, latitude, longitude, ...other }, signal);
    }
    editMessageLiveLocation(chat_id, message_id, latitude, longitude, other, signal) {
      return this.raw.editMessageLiveLocation({ chat_id, message_id, latitude, longitude, ...other }, signal);
    }
    editMessageLiveLocationInline(inline_message_id, latitude, longitude, other, signal) {
      return this.raw.editMessageLiveLocation({ inline_message_id, latitude, longitude, ...other }, signal);
    }
    stopMessageLiveLocation(chat_id, message_id, other, signal) {
      return this.raw.stopMessageLiveLocation({ chat_id, message_id, ...other }, signal);
    }
    stopMessageLiveLocationInline(inline_message_id, other, signal) {
      return this.raw.stopMessageLiveLocation({ inline_message_id, ...other }, signal);
    }
    sendPaidMedia(chat_id, star_count, media, other, signal) {
      return this.raw.sendPaidMedia({ chat_id, star_count, media, ...other }, signal);
    }
    sendVenue(chat_id, latitude, longitude, title, address, other, signal) {
      return this.raw.sendVenue({ chat_id, latitude, longitude, title, address, ...other }, signal);
    }
    sendContact(chat_id, phone_number, first_name, other, signal) {
      return this.raw.sendContact({ chat_id, phone_number, first_name, ...other }, signal);
    }
    sendPoll(chat_id, question, options, other, signal) {
      const opts = options.map((o) => typeof o === "string" ? { text: o } : o);
      return this.raw.sendPoll({ chat_id, question, options: opts, ...other }, signal);
    }
    sendChecklist(business_connection_id, chat_id, checklist, other, signal) {
      return this.raw.sendChecklist({
        business_connection_id,
        chat_id,
        checklist,
        ...other
      }, signal);
    }
    editMessageChecklist(business_connection_id, chat_id, message_id, checklist, other, signal) {
      return this.raw.editMessageChecklist({
        business_connection_id,
        chat_id,
        message_id,
        checklist,
        ...other
      }, signal);
    }
    sendDice(chat_id, emoji, other, signal) {
      return this.raw.sendDice({ chat_id, emoji, ...other }, signal);
    }
    setMessageReaction(chat_id, message_id, reaction, other, signal) {
      return this.raw.setMessageReaction({
        chat_id,
        message_id,
        reaction,
        ...other
      }, signal);
    }
    sendChatAction(chat_id, action, other, signal) {
      return this.raw.sendChatAction({ chat_id, action, ...other }, signal);
    }
    getUserProfilePhotos(user_id, other, signal) {
      return this.raw.getUserProfilePhotos({ user_id, ...other }, signal);
    }
    getUserProfileAudios(user_id, other, signal) {
      return this.raw.getUserProfileAudios({ user_id, ...other }, signal);
    }
    setUserEmojiStatus(user_id, other, signal) {
      return this.raw.setUserEmojiStatus({ user_id, ...other }, signal);
    }
    getUserChatBoosts(chat_id, user_id, signal) {
      return this.raw.getUserChatBoosts({ chat_id, user_id }, signal);
    }
    getUserGifts(user_id, other, signal) {
      return this.raw.getUserGifts({ user_id, ...other }, signal);
    }
    getChatGifts(chat_id, other, signal) {
      return this.raw.getChatGifts({ chat_id, ...other }, signal);
    }
    getBusinessConnection(business_connection_id, signal) {
      return this.raw.getBusinessConnection({ business_connection_id }, signal);
    }
    getFile(file_id, signal) {
      return this.raw.getFile({ file_id }, signal);
    }
    kickChatMember(...args) {
      return this.banChatMember(...args);
    }
    banChatMember(chat_id, user_id, other, signal) {
      return this.raw.banChatMember({ chat_id, user_id, ...other }, signal);
    }
    unbanChatMember(chat_id, user_id, other, signal) {
      return this.raw.unbanChatMember({ chat_id, user_id, ...other }, signal);
    }
    restrictChatMember(chat_id, user_id, permissions, other, signal) {
      return this.raw.restrictChatMember({ chat_id, user_id, permissions, ...other }, signal);
    }
    promoteChatMember(chat_id, user_id, other, signal) {
      return this.raw.promoteChatMember({ chat_id, user_id, ...other }, signal);
    }
    setChatAdministratorCustomTitle(chat_id, user_id, custom_title, signal) {
      return this.raw.setChatAdministratorCustomTitle({ chat_id, user_id, custom_title }, signal);
    }
    banChatSenderChat(chat_id, sender_chat_id, signal) {
      return this.raw.banChatSenderChat({ chat_id, sender_chat_id }, signal);
    }
    unbanChatSenderChat(chat_id, sender_chat_id, signal) {
      return this.raw.unbanChatSenderChat({ chat_id, sender_chat_id }, signal);
    }
    setChatPermissions(chat_id, permissions, other, signal) {
      return this.raw.setChatPermissions({ chat_id, permissions, ...other }, signal);
    }
    exportChatInviteLink(chat_id, signal) {
      return this.raw.exportChatInviteLink({ chat_id }, signal);
    }
    createChatInviteLink(chat_id, other, signal) {
      return this.raw.createChatInviteLink({ chat_id, ...other }, signal);
    }
    editChatInviteLink(chat_id, invite_link, other, signal) {
      return this.raw.editChatInviteLink({ chat_id, invite_link, ...other }, signal);
    }
    createChatSubscriptionInviteLink(chat_id, subscription_period, subscription_price, other, signal) {
      return this.raw.createChatSubscriptionInviteLink({ chat_id, subscription_period, subscription_price, ...other }, signal);
    }
    editChatSubscriptionInviteLink(chat_id, invite_link, other, signal) {
      return this.raw.editChatSubscriptionInviteLink({ chat_id, invite_link, ...other }, signal);
    }
    revokeChatInviteLink(chat_id, invite_link, signal) {
      return this.raw.revokeChatInviteLink({ chat_id, invite_link }, signal);
    }
    approveChatJoinRequest(chat_id, user_id, signal) {
      return this.raw.approveChatJoinRequest({ chat_id, user_id }, signal);
    }
    declineChatJoinRequest(chat_id, user_id, signal) {
      return this.raw.declineChatJoinRequest({ chat_id, user_id }, signal);
    }
    approveSuggestedPost(chat_id, message_id, other, signal) {
      return this.raw.approveSuggestedPost({ chat_id, message_id, ...other }, signal);
    }
    declineSuggestedPost(chat_id, message_id, other, signal) {
      return this.raw.declineSuggestedPost({ chat_id, message_id, ...other }, signal);
    }
    setChatPhoto(chat_id, photo, signal) {
      return this.raw.setChatPhoto({ chat_id, photo }, signal);
    }
    deleteChatPhoto(chat_id, signal) {
      return this.raw.deleteChatPhoto({ chat_id }, signal);
    }
    setChatTitle(chat_id, title, signal) {
      return this.raw.setChatTitle({ chat_id, title }, signal);
    }
    setChatDescription(chat_id, description, signal) {
      return this.raw.setChatDescription({ chat_id, description }, signal);
    }
    pinChatMessage(chat_id, message_id, other, signal) {
      return this.raw.pinChatMessage({ chat_id, message_id, ...other }, signal);
    }
    unpinChatMessage(chat_id, message_id, other, signal) {
      return this.raw.unpinChatMessage({ chat_id, message_id, ...other }, signal);
    }
    unpinAllChatMessages(chat_id, signal) {
      return this.raw.unpinAllChatMessages({ chat_id }, signal);
    }
    leaveChat(chat_id, signal) {
      return this.raw.leaveChat({ chat_id }, signal);
    }
    getChat(chat_id, signal) {
      return this.raw.getChat({ chat_id }, signal);
    }
    getChatAdministrators(chat_id, signal) {
      return this.raw.getChatAdministrators({ chat_id }, signal);
    }
    getChatMembersCount(...args) {
      return this.getChatMemberCount(...args);
    }
    getChatMemberCount(chat_id, signal) {
      return this.raw.getChatMemberCount({ chat_id }, signal);
    }
    getChatMember(chat_id, user_id, signal) {
      return this.raw.getChatMember({ chat_id, user_id }, signal);
    }
    setChatStickerSet(chat_id, sticker_set_name, signal) {
      return this.raw.setChatStickerSet({ chat_id, sticker_set_name }, signal);
    }
    deleteChatStickerSet(chat_id, signal) {
      return this.raw.deleteChatStickerSet({ chat_id }, signal);
    }
    getForumTopicIconStickers(signal) {
      return this.raw.getForumTopicIconStickers(signal);
    }
    createForumTopic(chat_id, name, other, signal) {
      return this.raw.createForumTopic({ chat_id, name, ...other }, signal);
    }
    editForumTopic(chat_id, message_thread_id, other, signal) {
      return this.raw.editForumTopic({ chat_id, message_thread_id, ...other }, signal);
    }
    closeForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.closeForumTopic({ chat_id, message_thread_id }, signal);
    }
    reopenForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.reopenForumTopic({ chat_id, message_thread_id }, signal);
    }
    deleteForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.deleteForumTopic({ chat_id, message_thread_id }, signal);
    }
    unpinAllForumTopicMessages(chat_id, message_thread_id, signal) {
      return this.raw.unpinAllForumTopicMessages({ chat_id, message_thread_id }, signal);
    }
    editGeneralForumTopic(chat_id, name, signal) {
      return this.raw.editGeneralForumTopic({ chat_id, name }, signal);
    }
    closeGeneralForumTopic(chat_id, signal) {
      return this.raw.closeGeneralForumTopic({ chat_id }, signal);
    }
    reopenGeneralForumTopic(chat_id, signal) {
      return this.raw.reopenGeneralForumTopic({ chat_id }, signal);
    }
    hideGeneralForumTopic(chat_id, signal) {
      return this.raw.hideGeneralForumTopic({ chat_id }, signal);
    }
    unhideGeneralForumTopic(chat_id, signal) {
      return this.raw.unhideGeneralForumTopic({ chat_id }, signal);
    }
    unpinAllGeneralForumTopicMessages(chat_id, signal) {
      return this.raw.unpinAllGeneralForumTopicMessages({ chat_id }, signal);
    }
    answerCallbackQuery(callback_query_id, other, signal) {
      return this.raw.answerCallbackQuery({ callback_query_id, ...other }, signal);
    }
    setMyName(name, other, signal) {
      return this.raw.setMyName({ name, ...other }, signal);
    }
    getMyName(other, signal) {
      return this.raw.getMyName(other !== null && other !== undefined ? other : {}, signal);
    }
    setMyCommands(commands, other, signal) {
      return this.raw.setMyCommands({ commands, ...other }, signal);
    }
    deleteMyCommands(other, signal) {
      return this.raw.deleteMyCommands({ ...other }, signal);
    }
    getMyCommands(other, signal) {
      return this.raw.getMyCommands({ ...other }, signal);
    }
    setMyDescription(description, other, signal) {
      return this.raw.setMyDescription({ description, ...other }, signal);
    }
    getMyDescription(other, signal) {
      return this.raw.getMyDescription({ ...other }, signal);
    }
    setMyShortDescription(short_description, other, signal) {
      return this.raw.setMyShortDescription({ short_description, ...other }, signal);
    }
    getMyShortDescription(other, signal) {
      return this.raw.getMyShortDescription({ ...other }, signal);
    }
    setMyProfilePhoto(photo, signal) {
      return this.raw.setMyProfilePhoto({ photo }, signal);
    }
    removeMyProfilePhoto(signal) {
      return this.raw.removeMyProfilePhoto(signal);
    }
    setChatMenuButton(other, signal) {
      return this.raw.setChatMenuButton({ ...other }, signal);
    }
    getChatMenuButton(other, signal) {
      return this.raw.getChatMenuButton({ ...other }, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
      return this.raw.setMyDefaultAdministratorRights({ ...other }, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
      return this.raw.getMyDefaultAdministratorRights({ ...other }, signal);
    }
    getMyStarBalance(signal) {
      return this.raw.getMyStarBalance(signal);
    }
    editMessageText(chat_id, message_id, text, other, signal) {
      return this.raw.editMessageText({ chat_id, message_id, text, ...other }, signal);
    }
    editMessageTextInline(inline_message_id, text, other, signal) {
      return this.raw.editMessageText({ inline_message_id, text, ...other }, signal);
    }
    editMessageCaption(chat_id, message_id, other, signal) {
      return this.raw.editMessageCaption({ chat_id, message_id, ...other }, signal);
    }
    editMessageCaptionInline(inline_message_id, other, signal) {
      return this.raw.editMessageCaption({ inline_message_id, ...other }, signal);
    }
    editMessageMedia(chat_id, message_id, media, other, signal) {
      return this.raw.editMessageMedia({ chat_id, message_id, media, ...other }, signal);
    }
    editMessageMediaInline(inline_message_id, media, other, signal) {
      return this.raw.editMessageMedia({ inline_message_id, media, ...other }, signal);
    }
    editMessageReplyMarkup(chat_id, message_id, other, signal) {
      return this.raw.editMessageReplyMarkup({ chat_id, message_id, ...other }, signal);
    }
    editMessageReplyMarkupInline(inline_message_id, other, signal) {
      return this.raw.editMessageReplyMarkup({ inline_message_id, ...other }, signal);
    }
    stopPoll(chat_id, message_id, other, signal) {
      return this.raw.stopPoll({ chat_id, message_id, ...other }, signal);
    }
    deleteMessage(chat_id, message_id, signal) {
      return this.raw.deleteMessage({ chat_id, message_id }, signal);
    }
    deleteMessages(chat_id, message_ids, signal) {
      return this.raw.deleteMessages({ chat_id, message_ids }, signal);
    }
    deleteBusinessMessages(business_connection_id, message_ids, signal) {
      return this.raw.deleteBusinessMessages({ business_connection_id, message_ids }, signal);
    }
    setBusinessAccountName(business_connection_id, first_name, other, signal) {
      return this.raw.setBusinessAccountName({ business_connection_id, first_name, ...other }, signal);
    }
    setBusinessAccountUsername(business_connection_id, username, signal) {
      return this.raw.setBusinessAccountUsername({ business_connection_id, username }, signal);
    }
    setBusinessAccountBio(business_connection_id, bio, signal) {
      return this.raw.setBusinessAccountBio({ business_connection_id, bio }, signal);
    }
    setBusinessAccountProfilePhoto(business_connection_id, photo, other, signal) {
      return this.raw.setBusinessAccountProfilePhoto({ business_connection_id, photo, ...other }, signal);
    }
    removeBusinessAccountProfilePhoto(business_connection_id, other, signal) {
      return this.raw.removeBusinessAccountProfilePhoto({ business_connection_id, ...other }, signal);
    }
    setBusinessAccountGiftSettings(business_connection_id, show_gift_button, accepted_gift_types, signal) {
      return this.raw.setBusinessAccountGiftSettings({ business_connection_id, show_gift_button, accepted_gift_types }, signal);
    }
    getBusinessAccountStarBalance(business_connection_id, signal) {
      return this.raw.getBusinessAccountStarBalance({ business_connection_id }, signal);
    }
    transferBusinessAccountStars(business_connection_id, star_count, signal) {
      return this.raw.transferBusinessAccountStars({ business_connection_id, star_count }, signal);
    }
    getBusinessAccountGifts(business_connection_id, other, signal) {
      return this.raw.getBusinessAccountGifts({ business_connection_id, ...other }, signal);
    }
    convertGiftToStars(business_connection_id, owned_gift_id, signal) {
      return this.raw.convertGiftToStars({ business_connection_id, owned_gift_id }, signal);
    }
    upgradeGift(business_connection_id, owned_gift_id, other, signal) {
      return this.raw.upgradeGift({ business_connection_id, owned_gift_id, ...other }, signal);
    }
    transferGift(business_connection_id, owned_gift_id, new_owner_chat_id, star_count, signal) {
      return this.raw.transferGift({
        business_connection_id,
        owned_gift_id,
        new_owner_chat_id,
        star_count
      }, signal);
    }
    postStory(business_connection_id, content, active_period, other, signal) {
      return this.raw.postStory({ business_connection_id, content, active_period, ...other }, signal);
    }
    repostStory(business_connection_id, from_chat_id, from_story_id, active_period, other, signal) {
      return this.raw.repostStory({
        business_connection_id,
        from_chat_id,
        from_story_id,
        active_period,
        ...other
      }, signal);
    }
    editStory(business_connection_id, story_id, content, other, signal) {
      return this.raw.editStory({ business_connection_id, story_id, content, ...other }, signal);
    }
    deleteStory(business_connection_id, story_id, signal) {
      return this.raw.deleteStory({ business_connection_id, story_id }, signal);
    }
    sendSticker(chat_id, sticker, other, signal) {
      return this.raw.sendSticker({ chat_id, sticker, ...other }, signal);
    }
    getStickerSet(name, signal) {
      return this.raw.getStickerSet({ name }, signal);
    }
    getCustomEmojiStickers(custom_emoji_ids, signal) {
      return this.raw.getCustomEmojiStickers({ custom_emoji_ids }, signal);
    }
    uploadStickerFile(user_id, sticker_format, sticker, signal) {
      return this.raw.uploadStickerFile({ user_id, sticker_format, sticker }, signal);
    }
    createNewStickerSet(user_id, name, title, stickers, other, signal) {
      return this.raw.createNewStickerSet({ user_id, name, title, stickers, ...other }, signal);
    }
    addStickerToSet(user_id, name, sticker, signal) {
      return this.raw.addStickerToSet({ user_id, name, sticker }, signal);
    }
    setStickerPositionInSet(sticker, position, signal) {
      return this.raw.setStickerPositionInSet({ sticker, position }, signal);
    }
    deleteStickerFromSet(sticker, signal) {
      return this.raw.deleteStickerFromSet({ sticker }, signal);
    }
    replaceStickerInSet(user_id, name, old_sticker, sticker, signal) {
      return this.raw.replaceStickerInSet({ user_id, name, old_sticker, sticker }, signal);
    }
    setStickerEmojiList(sticker, emoji_list, signal) {
      return this.raw.setStickerEmojiList({ sticker, emoji_list }, signal);
    }
    setStickerKeywords(sticker, keywords, signal) {
      return this.raw.setStickerKeywords({ sticker, keywords }, signal);
    }
    setStickerMaskPosition(sticker, mask_position, signal) {
      return this.raw.setStickerMaskPosition({ sticker, mask_position }, signal);
    }
    setStickerSetTitle(name, title, signal) {
      return this.raw.setStickerSetTitle({ name, title }, signal);
    }
    deleteStickerSet(name, signal) {
      return this.raw.deleteStickerSet({ name }, signal);
    }
    setStickerSetThumbnail(name, user_id, thumbnail, format, signal) {
      return this.raw.setStickerSetThumbnail({ name, user_id, thumbnail, format }, signal);
    }
    setCustomEmojiStickerSetThumbnail(name, custom_emoji_id, signal) {
      return this.raw.setCustomEmojiStickerSetThumbnail({
        name,
        custom_emoji_id
      }, signal);
    }
    getAvailableGifts(signal) {
      return this.raw.getAvailableGifts(signal);
    }
    sendGift(user_id, gift_id, other, signal) {
      return this.raw.sendGift({ user_id, gift_id, ...other }, signal);
    }
    giftPremiumSubscription(user_id, month_count, star_count, other, signal) {
      return this.raw.giftPremiumSubscription({ user_id, month_count, star_count, ...other }, signal);
    }
    sendGiftToChannel(chat_id, gift_id, other, signal) {
      return this.raw.sendGift({ chat_id, gift_id, ...other }, signal);
    }
    answerInlineQuery(inline_query_id, results, other, signal) {
      return this.raw.answerInlineQuery({ inline_query_id, results, ...other }, signal);
    }
    answerWebAppQuery(web_app_query_id, result, signal) {
      return this.raw.answerWebAppQuery({ web_app_query_id, result }, signal);
    }
    savePreparedInlineMessage(user_id, result, other, signal) {
      return this.raw.savePreparedInlineMessage({ user_id, result, ...other }, signal);
    }
    sendInvoice(chat_id, title, description, payload, currency, prices, other, signal) {
      return this.raw.sendInvoice({
        chat_id,
        title,
        description,
        payload,
        currency,
        prices,
        ...other
      }, signal);
    }
    createInvoiceLink(title, description, payload, provider_token, currency, prices, other, signal) {
      return this.raw.createInvoiceLink({
        title,
        description,
        payload,
        provider_token,
        currency,
        prices,
        ...other
      }, signal);
    }
    answerShippingQuery(shipping_query_id, ok, other, signal) {
      return this.raw.answerShippingQuery({ shipping_query_id, ok, ...other }, signal);
    }
    answerPreCheckoutQuery(pre_checkout_query_id, ok, other, signal) {
      return this.raw.answerPreCheckoutQuery({ pre_checkout_query_id, ok, ...other }, signal);
    }
    getStarTransactions(other, signal) {
      return this.raw.getStarTransactions({ ...other }, signal);
    }
    refundStarPayment(user_id, telegram_payment_charge_id, signal) {
      return this.raw.refundStarPayment({ user_id, telegram_payment_charge_id }, signal);
    }
    editUserStarSubscription(user_id, telegram_payment_charge_id, is_canceled, signal) {
      return this.raw.editUserStarSubscription({ user_id, telegram_payment_charge_id, is_canceled }, signal);
    }
    verifyUser(user_id, other, signal) {
      return this.raw.verifyUser({ user_id, ...other }, signal);
    }
    verifyChat(chat_id, other, signal) {
      return this.raw.verifyChat({ chat_id, ...other }, signal);
    }
    removeUserVerification(user_id, signal) {
      return this.raw.removeUserVerification({ user_id }, signal);
    }
    removeChatVerification(chat_id, signal) {
      return this.raw.removeChatVerification({ chat_id }, signal);
    }
    readBusinessMessage(business_connection_id, chat_id, message_id, signal) {
      return this.raw.readBusinessMessage({ business_connection_id, chat_id, message_id }, signal);
    }
    setPassportDataErrors(user_id, errors, signal) {
      return this.raw.setPassportDataErrors({ user_id, errors }, signal);
    }
    sendGame(chat_id, game_short_name, other, signal) {
      return this.raw.sendGame({ chat_id, game_short_name, ...other }, signal);
    }
    setGameScore(chat_id, message_id, user_id, score, other, signal) {
      return this.raw.setGameScore({ chat_id, message_id, user_id, score, ...other }, signal);
    }
    setGameScoreInline(inline_message_id, user_id, score, other, signal) {
      return this.raw.setGameScore({ inline_message_id, user_id, score, ...other }, signal);
    }
    getGameHighScores(chat_id, message_id, user_id, signal) {
      return this.raw.getGameHighScores({ chat_id, message_id, user_id }, signal);
    }
    getGameHighScoresInline(inline_message_id, user_id, signal) {
      return this.raw.getGameHighScores({ inline_message_id, user_id }, signal);
    }
  }
  exports.Api = Api;
});

// node_modules/grammy/out/bot.js
var require_bot = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Bot = exports.BotError = exports.DEFAULT_UPDATE_TYPES = undefined;
  var composer_js_1 = require_composer();
  Object.defineProperty(exports, "BotError", { enumerable: true, get: function() {
    return composer_js_1.BotError;
  } });
  var context_js_1 = require_context();
  var api_js_1 = require_api();
  var error_js_1 = require_error();
  var filter_js_1 = require_filter();
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:bot");
  var debugWarn = (0, platform_node_js_1.debug)("grammy:warn");
  var debugErr = (0, platform_node_js_1.debug)("grammy:error");
  exports.DEFAULT_UPDATE_TYPES = [
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "business_connection",
    "business_message",
    "edited_business_message",
    "deleted_business_messages",
    "inline_query",
    "chosen_inline_result",
    "callback_query",
    "shipping_query",
    "pre_checkout_query",
    "purchased_paid_media",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_join_request",
    "chat_boost",
    "removed_chat_boost"
  ];

  class Bot extends composer_js_1.Composer {
    constructor(token, config) {
      var _a;
      super();
      this.token = token;
      this.pollingRunning = false;
      this.lastTriedUpdateId = 0;
      this.observedUpdateTypes = new Set;
      this.errorHandler = async (err) => {
        var _a2, _b;
        console.error("Error in middleware while handling update", (_b = (_a2 = err.ctx) === null || _a2 === undefined ? undefined : _a2.update) === null || _b === undefined ? undefined : _b.update_id, err.error);
        console.error("No error handler was set!");
        console.error("Set your own error handler with `bot.catch = ...`");
        if (this.pollingRunning) {
          console.error("Stopping bot");
          await this.stop();
        }
        throw err;
      };
      if (!token)
        throw new Error("Empty token!");
      this.me = config === null || config === undefined ? undefined : config.botInfo;
      this.clientConfig = config === null || config === undefined ? undefined : config.client;
      this.ContextConstructor = (_a = config === null || config === undefined ? undefined : config.ContextConstructor) !== null && _a !== undefined ? _a : context_js_1.Context;
      this.api = new api_js_1.Api(token, this.clientConfig);
    }
    set botInfo(botInfo) {
      this.me = botInfo;
    }
    get botInfo() {
      if (this.me === undefined) {
        throw new Error("Bot information unavailable! Make sure to call `await bot.init()` before accessing `bot.botInfo`!");
      }
      return this.me;
    }
    on(filter, ...middleware) {
      for (const [u] of (0, filter_js_1.parse)(filter).flatMap(filter_js_1.preprocess)) {
        this.observedUpdateTypes.add(u);
      }
      return super.on(filter, ...middleware);
    }
    reaction(reaction, ...middleware) {
      this.observedUpdateTypes.add("message_reaction");
      return super.reaction(reaction, ...middleware);
    }
    isInited() {
      return this.me !== undefined;
    }
    async init(signal) {
      var _a;
      if (!this.isInited()) {
        debug("Initializing bot");
        (_a = this.mePromise) !== null && _a !== undefined || (this.mePromise = withRetries(() => this.api.getMe(signal), signal));
        let me;
        try {
          me = await this.mePromise;
        } finally {
          this.mePromise = undefined;
        }
        if (this.me === undefined)
          this.me = me;
        else
          debug("Bot info was set by now, will not overwrite");
      }
      debug(`I am ${this.me.username}!`);
    }
    async handleUpdates(updates) {
      for (const update of updates) {
        this.lastTriedUpdateId = update.update_id;
        try {
          await this.handleUpdate(update);
        } catch (err) {
          if (err instanceof composer_js_1.BotError) {
            await this.errorHandler(err);
          } else {
            console.error("FATAL: grammY unable to handle:", err);
            throw err;
          }
        }
      }
    }
    async handleUpdate(update, webhookReplyEnvelope) {
      if (this.me === undefined) {
        throw new Error("Bot not initialized! Either call `await bot.init()`, or directly set the `botInfo` option in the `Bot` constructor to specify a known bot info object.");
      }
      debug(`Processing update ${update.update_id}`);
      const api = new api_js_1.Api(this.token, this.clientConfig, webhookReplyEnvelope);
      const t = this.api.config.installedTransformers();
      if (t.length > 0)
        api.config.use(...t);
      const ctx = new this.ContextConstructor(update, api, this.me);
      try {
        await (0, composer_js_1.run)(this.middleware(), ctx);
      } catch (err) {
        debugErr(`Error in middleware for update ${update.update_id}`);
        throw new composer_js_1.BotError(err, ctx);
      }
    }
    async start(options) {
      var _a, _b, _c;
      const setup = [];
      if (!this.isInited()) {
        setup.push(this.init((_a = this.pollingAbortController) === null || _a === undefined ? undefined : _a.signal));
      }
      if (this.pollingRunning) {
        await Promise.all(setup);
        debug("Simple long polling already running!");
        return;
      }
      this.pollingRunning = true;
      this.pollingAbortController = new shim_node_js_1.AbortController;
      try {
        setup.push(withRetries(async () => {
          var _a2;
          await this.api.deleteWebhook({
            drop_pending_updates: options === null || options === undefined ? undefined : options.drop_pending_updates
          }, (_a2 = this.pollingAbortController) === null || _a2 === undefined ? undefined : _a2.signal);
        }, (_b = this.pollingAbortController) === null || _b === undefined ? undefined : _b.signal));
        await Promise.all(setup);
        await ((_c = options === null || options === undefined ? undefined : options.onStart) === null || _c === undefined ? undefined : _c.call(options, this.botInfo));
      } catch (err) {
        this.pollingRunning = false;
        this.pollingAbortController = undefined;
        throw err;
      }
      if (!this.pollingRunning)
        return;
      validateAllowedUpdates(this.observedUpdateTypes, options === null || options === undefined ? undefined : options.allowed_updates);
      this.use = noUseFunction;
      debug("Starting simple long polling");
      await this.loop(options);
      debug("Middleware is done running");
    }
    async stop() {
      var _a;
      if (this.pollingRunning) {
        debug("Stopping bot, saving update offset");
        this.pollingRunning = false;
        (_a = this.pollingAbortController) === null || _a === undefined || _a.abort();
        const offset = this.lastTriedUpdateId + 1;
        await this.api.getUpdates({ offset, limit: 1 }).finally(() => this.pollingAbortController = undefined);
      } else {
        debug("Bot is not running!");
      }
    }
    isRunning() {
      return this.pollingRunning;
    }
    catch(errorHandler) {
      this.errorHandler = errorHandler;
    }
    async loop(options) {
      var _a, _b;
      const limit = options === null || options === undefined ? undefined : options.limit;
      const timeout = (_a = options === null || options === undefined ? undefined : options.timeout) !== null && _a !== undefined ? _a : 30;
      let allowed_updates = (_b = options === null || options === undefined ? undefined : options.allowed_updates) !== null && _b !== undefined ? _b : [];
      try {
        while (this.pollingRunning) {
          const updates = await this.fetchUpdates({ limit, timeout, allowed_updates });
          if (updates === undefined)
            break;
          await this.handleUpdates(updates);
          allowed_updates = undefined;
        }
      } finally {
        this.pollingRunning = false;
      }
    }
    async fetchUpdates({ limit, timeout, allowed_updates }) {
      var _a;
      const offset = this.lastTriedUpdateId + 1;
      let updates = undefined;
      do {
        try {
          updates = await this.api.getUpdates({ offset, limit, timeout, allowed_updates }, (_a = this.pollingAbortController) === null || _a === undefined ? undefined : _a.signal);
        } catch (error) {
          await this.handlePollingError(error);
        }
      } while (updates === undefined && this.pollingRunning);
      return updates;
    }
    async handlePollingError(error) {
      var _a;
      if (!this.pollingRunning) {
        debug("Pending getUpdates request cancelled");
        return;
      }
      let sleepSeconds = 3;
      if (error instanceof error_js_1.GrammyError) {
        debugErr(error.message);
        if (error.error_code === 401 || error.error_code === 409) {
          throw error;
        } else if (error.error_code === 429) {
          debugErr("Bot API server is closing.");
          sleepSeconds = (_a = error.parameters.retry_after) !== null && _a !== undefined ? _a : sleepSeconds;
        }
      } else
        debugErr(error);
      debugErr(`Call to getUpdates failed, retrying in ${sleepSeconds} seconds ...`);
      await sleep(sleepSeconds);
    }
  }
  exports.Bot = Bot;
  async function withRetries(task, signal) {
    const INITIAL_DELAY = 50;
    let lastDelay = INITIAL_DELAY;
    async function handleError(error) {
      let delay = false;
      let strategy = "rethrow";
      if (error instanceof error_js_1.HttpError) {
        delay = true;
        strategy = "retry";
      } else if (error instanceof error_js_1.GrammyError) {
        if (error.error_code >= 500) {
          delay = true;
          strategy = "retry";
        } else if (error.error_code === 429) {
          const retryAfter = error.parameters.retry_after;
          if (typeof retryAfter === "number") {
            await sleep(retryAfter, signal);
            lastDelay = INITIAL_DELAY;
          } else {
            delay = true;
          }
          strategy = "retry";
        }
      }
      if (delay) {
        if (lastDelay !== INITIAL_DELAY) {
          await sleep(lastDelay, signal);
        }
        const TWENTY_MINUTES = 20 * 60 * 1000;
        lastDelay = Math.min(TWENTY_MINUTES, 2 * lastDelay);
      }
      return strategy;
    }
    let result = { ok: false };
    while (!result.ok) {
      try {
        result = { ok: true, value: await task() };
      } catch (error) {
        debugErr(error);
        const strategy = await handleError(error);
        switch (strategy) {
          case "retry":
            continue;
          case "rethrow":
            throw error;
        }
      }
    }
    return result.value;
  }
  async function sleep(seconds, signal) {
    let handle;
    let reject;
    function abort() {
      reject === null || reject === undefined || reject(new Error("Aborted delay"));
      if (handle !== undefined)
        clearTimeout(handle);
    }
    try {
      await new Promise((res, rej) => {
        reject = rej;
        if (signal === null || signal === undefined ? undefined : signal.aborted) {
          abort();
          return;
        }
        signal === null || signal === undefined || signal.addEventListener("abort", abort);
        handle = setTimeout(res, 1000 * seconds);
      });
    } finally {
      signal === null || signal === undefined || signal.removeEventListener("abort", abort);
    }
  }
  function validateAllowedUpdates(updates, allowed = exports.DEFAULT_UPDATE_TYPES) {
    const impossible = Array.from(updates).filter((u) => !allowed.includes(u));
    if (impossible.length > 0) {
      debugWarn(`You registered listeners for the following update types, but you did not specify them in \`allowed_updates\` so they may not be received: ${impossible.map((u) => `'${u}'`).join(", ")}`);
    }
  }
  function noUseFunction() {
    throw new Error(`It looks like you are registering more listeners on your bot from within other listeners! This means that every time your bot handles a message like this one, new listeners will be added. This list grows until your machine crashes, so grammY throws this error to tell you that you should probably do things a bit differently. If you're unsure how to resolve this problem, you can ask in the group chat: https://telegram.me/grammyjs

On the other hand, if you actually know what you're doing and you do need to install further middleware while your bot is running, consider installing a composer instance on your bot, and in turn augment the composer after the fact. This way, you can circumvent this protection against memory leaks.`);
  }
  var shim_node_js_1 = require_shim_node();
});

// node_modules/grammy/out/convenience/constants.js
var require_constants = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.API_CONSTANTS = undefined;
  var bot_js_1 = require_bot();
  var ALL_UPDATE_TYPES = [
    ...bot_js_1.DEFAULT_UPDATE_TYPES,
    "chat_member",
    "message_reaction",
    "message_reaction_count"
  ];
  var ALL_CHAT_PERMISSIONS = {
    is_anonymous: true,
    can_manage_chat: true,
    can_delete_messages: true,
    can_manage_video_chats: true,
    can_restrict_members: true,
    can_promote_members: true,
    can_change_info: true,
    can_invite_users: true,
    can_post_stories: true,
    can_edit_stories: true,
    can_delete_stories: true,
    can_post_messages: true,
    can_edit_messages: true,
    can_pin_messages: true,
    can_manage_topics: true
  };
  exports.API_CONSTANTS = {
    DEFAULT_UPDATE_TYPES: bot_js_1.DEFAULT_UPDATE_TYPES,
    ALL_UPDATE_TYPES,
    ALL_CHAT_PERMISSIONS
  };
  Object.freeze(exports.API_CONSTANTS);
});

// node_modules/grammy/out/convenience/inline_query.js
var require_inline_query = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineQueryResultBuilder = undefined;
  function inputMessage(queryTemplate) {
    return {
      ...queryTemplate,
      ...inputMessageMethods(queryTemplate)
    };
  }
  function inputMessageMethods(queryTemplate) {
    return {
      text(message_text, options = {}) {
        const content = {
          message_text,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      location(latitude, longitude, options = {}) {
        const content = {
          latitude,
          longitude,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      venue(title, latitude, longitude, address, options) {
        const content = {
          title,
          latitude,
          longitude,
          address,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      contact(first_name, phone_number, options = {}) {
        const content = {
          first_name,
          phone_number,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      invoice(title, description, payload, provider_token, currency, prices, options = {}) {
        const content = {
          title,
          description,
          payload,
          provider_token,
          currency,
          prices,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      }
    };
  }
  exports.InlineQueryResultBuilder = {
    article(id, title, options = {}) {
      return inputMessageMethods({ type: "article", id, title, ...options });
    },
    audio(id, title, audio_url, options = {}) {
      return inputMessage({
        type: "audio",
        id,
        title,
        audio_url: typeof audio_url === "string" ? audio_url : audio_url.href,
        ...options
      });
    },
    audioCached(id, audio_file_id, options = {}) {
      return inputMessage({ type: "audio", id, audio_file_id, ...options });
    },
    contact(id, phone_number, first_name, options = {}) {
      return inputMessage({ type: "contact", id, phone_number, first_name, ...options });
    },
    documentPdf(id, title, document_url, options = {}) {
      return inputMessage({
        type: "document",
        mime_type: "application/pdf",
        id,
        title,
        document_url: typeof document_url === "string" ? document_url : document_url.href,
        ...options
      });
    },
    documentZip(id, title, document_url, options = {}) {
      return inputMessage({
        type: "document",
        mime_type: "application/zip",
        id,
        title,
        document_url: typeof document_url === "string" ? document_url : document_url.href,
        ...options
      });
    },
    documentCached(id, title, document_file_id, options = {}) {
      return inputMessage({ type: "document", id, title, document_file_id, ...options });
    },
    game(id, game_short_name, options = {}) {
      return { type: "game", id, game_short_name, ...options };
    },
    gif(id, gif_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "gif",
        id,
        gif_url: typeof gif_url === "string" ? gif_url : gif_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    gifCached(id, gif_file_id, options = {}) {
      return inputMessage({ type: "gif", id, gif_file_id, ...options });
    },
    location(id, title, latitude, longitude, options = {}) {
      return inputMessage({ type: "location", id, title, latitude, longitude, ...options });
    },
    mpeg4gif(id, mpeg4_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "mpeg4_gif",
        id,
        mpeg4_url: typeof mpeg4_url === "string" ? mpeg4_url : mpeg4_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    mpeg4gifCached(id, mpeg4_file_id, options = {}) {
      return inputMessage({ type: "mpeg4_gif", id, mpeg4_file_id, ...options });
    },
    photo(id, photo_url, options = {
      thumbnail_url: typeof photo_url === "string" ? photo_url : photo_url.href
    }) {
      return inputMessage({
        type: "photo",
        id,
        photo_url: typeof photo_url === "string" ? photo_url : photo_url.href,
        ...options
      });
    },
    photoCached(id, photo_file_id, options = {}) {
      return inputMessage({ type: "photo", id, photo_file_id, ...options });
    },
    stickerCached(id, sticker_file_id, options = {}) {
      return inputMessage({ type: "sticker", id, sticker_file_id, ...options });
    },
    venue(id, title, latitude, longitude, address, options = {}) {
      return inputMessage({
        type: "venue",
        id,
        title,
        latitude,
        longitude,
        address,
        ...options
      });
    },
    videoHtml(id, title, video_url, thumbnail_url, options = {}) {
      return inputMessageMethods({
        type: "video",
        mime_type: "text/html",
        id,
        title,
        video_url: typeof video_url === "string" ? video_url : video_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    videoMp4(id, title, video_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "video",
        mime_type: "video/mp4",
        id,
        title,
        video_url: typeof video_url === "string" ? video_url : video_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    videoCached(id, title, video_file_id, options = {}) {
      return inputMessage({ type: "video", id, title, video_file_id, ...options });
    },
    voice(id, title, voice_url, options = {}) {
      return inputMessage({
        type: "voice",
        id,
        title,
        voice_url: typeof voice_url === "string" ? voice_url : voice_url.href,
        ...options
      });
    },
    voiceCached(id, title, voice_file_id, options = {}) {
      return inputMessage({ type: "voice", id, title, voice_file_id, ...options });
    }
  };
});

// node_modules/grammy/out/convenience/input_media.js
var require_input_media = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InputMediaBuilder = undefined;
  exports.InputMediaBuilder = {
    photo(media, options = {}) {
      return { type: "photo", media, ...options };
    },
    video(media, options = {}) {
      return { type: "video", media, ...options };
    },
    animation(media, options = {}) {
      return { type: "animation", media, ...options };
    },
    audio(media, options = {}) {
      return { type: "audio", media, ...options };
    },
    document(media, options = {}) {
      return { type: "document", media, ...options };
    }
  };
});

// node_modules/grammy/out/convenience/keyboard.js
var require_keyboard = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineKeyboard = exports.Keyboard = undefined;

  class Keyboard {
    constructor(keyboard = [[]]) {
      this.keyboard = keyboard;
    }
    add(...buttons) {
      var _a;
      (_a = this.keyboard[this.keyboard.length - 1]) === null || _a === undefined || _a.push(...buttons);
      return this;
    }
    row(...buttons) {
      this.keyboard.push(buttons);
      return this;
    }
    text(text, options) {
      return this.add(Keyboard.text(text, options));
    }
    static text(text, options) {
      return typeof options === "string" ? { text, style: options } : { text, ...options };
    }
    requestUsers(text, requestId, options = {}) {
      return this.add(Keyboard.requestUsers(text, requestId, options));
    }
    static requestUsers(text, requestId, options = {}) {
      return typeof text === "string" ? { text, request_users: { request_id: requestId, ...options } } : { ...text, request_users: { request_id: requestId, ...options } };
    }
    requestChat(text, requestId, options = {
      chat_is_channel: false
    }) {
      return this.add(Keyboard.requestChat(text, requestId, options));
    }
    static requestChat(text, requestId, options = {
      chat_is_channel: false
    }) {
      const request_chat = { request_id: requestId, ...options };
      return typeof text === "string" ? { text, request_chat } : { ...text, request_chat };
    }
    requestContact(text) {
      return this.add(Keyboard.requestContact(text));
    }
    static requestContact(text) {
      const request_contact = true;
      return typeof text === "string" ? { text, request_contact } : { ...text, request_contact };
    }
    requestLocation(text) {
      return this.add(Keyboard.requestLocation(text));
    }
    static requestLocation(text) {
      const request_location = true;
      return typeof text === "string" ? { text, request_location } : { ...text, request_location };
    }
    requestPoll(text, type) {
      return this.add(Keyboard.requestPoll(text, type));
    }
    static requestPoll(text, type) {
      const request_poll = { type };
      return typeof text === "string" ? { text, request_poll } : { ...text, request_poll };
    }
    webApp(text, url) {
      return this.add(Keyboard.webApp(text, url));
    }
    static webApp(text, url) {
      const web_app = { url };
      return typeof text === "string" ? { text, web_app } : { ...text, web_app };
    }
    style(style) {
      const rows = this.keyboard.length;
      if (rows === 0) {
        throw new Error("Need to add a button before applying a style!");
      }
      const lastRow = this.keyboard[rows - 1];
      const cols = lastRow.length;
      if (cols === 0) {
        throw new Error("Need to add a button before applying a style!");
      }
      let lastButton = lastRow[cols - 1];
      if (typeof lastButton === "string") {
        lastButton = { text: lastButton };
        lastRow[cols - 1] = lastButton;
      }
      lastButton.style = style;
      return this;
    }
    danger() {
      return this.style("danger");
    }
    success() {
      return this.style("success");
    }
    primary() {
      return this.style("primary");
    }
    icon(icon) {
      const rows = this.keyboard.length;
      if (rows === 0) {
        throw new Error("Need to add a button before adding an icon!");
      }
      const lastRow = this.keyboard[rows - 1];
      const cols = lastRow.length;
      if (cols === 0) {
        throw new Error("Need to add a button before adding an icon!");
      }
      let lastButton = lastRow[cols - 1];
      if (typeof lastButton === "string") {
        lastButton = { text: lastButton };
        lastRow[cols - 1] = lastButton;
      }
      lastButton.icon_custom_emoji_id = icon;
      return this;
    }
    persistent(isEnabled = true) {
      this.is_persistent = isEnabled;
      return this;
    }
    selected(isEnabled = true) {
      this.selective = isEnabled;
      return this;
    }
    oneTime(isEnabled = true) {
      this.one_time_keyboard = isEnabled;
      return this;
    }
    resized(isEnabled = true) {
      this.resize_keyboard = isEnabled;
      return this;
    }
    placeholder(value) {
      this.input_field_placeholder = value;
      return this;
    }
    toTransposed() {
      const original = this.keyboard;
      const transposed = transpose(original);
      return this.clone(transposed);
    }
    toFlowed(columns, options = {}) {
      const original = this.keyboard;
      const flowed = reflow(original, columns, options);
      return this.clone(flowed);
    }
    clone(keyboard = this.keyboard) {
      const clone = new Keyboard(keyboard.map((row) => row.slice()));
      clone.is_persistent = this.is_persistent;
      clone.selective = this.selective;
      clone.one_time_keyboard = this.one_time_keyboard;
      clone.resize_keyboard = this.resize_keyboard;
      clone.input_field_placeholder = this.input_field_placeholder;
      return clone;
    }
    append(...sources) {
      for (const source of sources) {
        const keyboard = Keyboard.from(source);
        this.keyboard.push(...keyboard.keyboard.map((row) => row.slice()));
      }
      return this;
    }
    build() {
      return this.keyboard;
    }
    static from(source) {
      if (source instanceof Keyboard)
        return source.clone();
      function toButton(btn) {
        return typeof btn === "string" ? Keyboard.text(btn) : btn;
      }
      return new Keyboard(source.map((row) => row.map(toButton)));
    }
  }
  exports.Keyboard = Keyboard;

  class InlineKeyboard {
    constructor(inline_keyboard = [[]]) {
      this.inline_keyboard = inline_keyboard;
    }
    add(...buttons) {
      var _a;
      (_a = this.inline_keyboard[this.inline_keyboard.length - 1]) === null || _a === undefined || _a.push(...buttons);
      return this;
    }
    row(...buttons) {
      this.inline_keyboard.push(buttons);
      return this;
    }
    url(text, url) {
      return this.add(InlineKeyboard.url(text, url));
    }
    static url(text, url) {
      return typeof text === "string" ? { text, url } : { ...text, url };
    }
    text(text, data = typeof text === "string" ? text : text.text) {
      return this.add(InlineKeyboard.text(text, data));
    }
    static text(text, data = typeof text === "string" ? text : text.text) {
      return typeof text === "string" ? { text, callback_data: data } : { ...text, callback_data: data };
    }
    webApp(text, url) {
      return this.add(InlineKeyboard.webApp(text, url));
    }
    static webApp(text, url) {
      const web_app = typeof url === "string" ? { url } : url;
      return typeof text === "string" ? { text, web_app } : { ...text, web_app };
    }
    login(text, loginUrl) {
      return this.add(InlineKeyboard.login(text, loginUrl));
    }
    static login(text, loginUrl) {
      const login_url = typeof loginUrl === "string" ? { url: loginUrl } : loginUrl;
      return typeof text === "string" ? { text, login_url } : { ...text, login_url };
    }
    switchInline(text, query = "") {
      return this.add(InlineKeyboard.switchInline(text, query));
    }
    static switchInline(text, query = "") {
      return typeof text === "string" ? { text, switch_inline_query: query } : { ...text, switch_inline_query: query };
    }
    switchInlineCurrent(text, query = "") {
      return this.add(InlineKeyboard.switchInlineCurrent(text, query));
    }
    static switchInlineCurrent(text, query = "") {
      return typeof text === "string" ? { text, switch_inline_query_current_chat: query } : { ...text, switch_inline_query_current_chat: query };
    }
    switchInlineChosen(text, query = {}) {
      return this.add(InlineKeyboard.switchInlineChosen(text, query));
    }
    static switchInlineChosen(text, query = {}) {
      return typeof text === "string" ? { text, switch_inline_query_chosen_chat: query } : { ...text, switch_inline_query_chosen_chat: query };
    }
    copyText(text, copyText) {
      return this.add(InlineKeyboard.copyText(text, copyText));
    }
    static copyText(text, copyText) {
      const copy_text = typeof copyText === "string" ? { text: copyText } : copyText;
      return typeof text === "string" ? { text, copy_text } : { ...text, copy_text };
    }
    game(text) {
      return this.add(InlineKeyboard.game(text));
    }
    static game(text) {
      const callback_game = {};
      return typeof text === "string" ? { text, callback_game } : { ...text, callback_game };
    }
    pay(text) {
      return this.add(InlineKeyboard.pay(text));
    }
    static pay(text) {
      const pay = true;
      return typeof text === "string" ? { text, pay } : { ...text, pay };
    }
    style(style) {
      const rows = this.inline_keyboard.length;
      if (rows === 0) {
        throw new Error("Need to add a button before applying a style!");
      }
      const lastRow = this.inline_keyboard[rows - 1];
      const cols = lastRow.length;
      if (cols === 0) {
        throw new Error("Need to add a button before applying a style!");
      }
      lastRow[cols - 1].style = style;
      return this;
    }
    danger() {
      return this.style("danger");
    }
    success() {
      return this.style("success");
    }
    primary() {
      return this.style("primary");
    }
    icon(icon) {
      const rows = this.inline_keyboard.length;
      if (rows === 0) {
        throw new Error("Need to add a button before adding an icon!");
      }
      const lastRow = this.inline_keyboard[rows - 1];
      const cols = lastRow.length;
      if (cols === 0) {
        throw new Error("Need to add a button before adding an icon!");
      }
      lastRow[cols - 1].icon_custom_emoji_id = icon;
      return this;
    }
    toTransposed() {
      const original = this.inline_keyboard;
      const transposed = transpose(original);
      return new InlineKeyboard(transposed);
    }
    toFlowed(columns, options = {}) {
      const original = this.inline_keyboard;
      const flowed = reflow(original, columns, options);
      return new InlineKeyboard(flowed);
    }
    clone() {
      return new InlineKeyboard(this.inline_keyboard.map((row) => row.slice()));
    }
    append(...sources) {
      for (const source of sources) {
        const keyboard = InlineKeyboard.from(source);
        this.inline_keyboard.push(...keyboard.inline_keyboard.map((row) => row.slice()));
      }
      return this;
    }
    static from(source) {
      if (source instanceof InlineKeyboard)
        return source.clone();
      return new InlineKeyboard(source.map((row) => row.slice()));
    }
  }
  exports.InlineKeyboard = InlineKeyboard;
  function transpose(grid) {
    var _a;
    const transposed = [];
    for (let i = 0;i < grid.length; i++) {
      const row = grid[i];
      for (let j = 0;j < row.length; j++) {
        const button = row[j];
        ((_a = transposed[j]) !== null && _a !== undefined ? _a : transposed[j] = []).push(button);
      }
    }
    return transposed;
  }
  function reflow(grid, columns, { fillLastRow = false }) {
    var _a;
    let first = columns;
    if (fillLastRow) {
      const buttonCount = grid.map((row) => row.length).reduce((a, b) => a + b, 0);
      first = buttonCount % columns;
    }
    const reflowed = [];
    for (const row of grid) {
      for (const button of row) {
        const at = Math.max(0, reflowed.length - 1);
        const max = at === 0 ? first : columns;
        let next = (_a = reflowed[at]) !== null && _a !== undefined ? _a : reflowed[at] = [];
        if (next.length === max) {
          next = [];
          reflowed.push(next);
        }
        next.push(button);
      }
    }
    return reflowed;
  }
});

// node_modules/grammy/out/convenience/session.js
var require_session = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MemorySessionStorage = undefined;
  exports.session = session;
  exports.lazySession = lazySession;
  exports.enhanceStorage = enhanceStorage;
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:session");
  function session(options = {}) {
    return options.type === "multi" ? strictMultiSession(options) : strictSingleSession(options);
  }
  function strictSingleSession(options) {
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
      const propSession = new PropertySession(storage, ctx, "session", initial);
      const key = await getSessionKey(ctx);
      await propSession.init(key, { custom, lazy: false });
      await next();
      await propSession.finish();
    };
  }
  function strictMultiSession(options) {
    const props = Object.keys(options).filter((k) => k !== "type");
    const defaults = Object.fromEntries(props.map((prop) => [prop, fillDefaults(options[prop])]));
    return async (ctx, next) => {
      ctx.session = {};
      const propSessions = await Promise.all(props.map(async (prop) => {
        const { initial, storage, getSessionKey, custom } = defaults[prop];
        const s = new PropertySession(storage, ctx.session, prop, initial);
        const key = await getSessionKey(ctx);
        await s.init(key, { custom, lazy: false });
        return s;
      }));
      await next();
      if (ctx.session == null)
        propSessions.forEach((s) => s.delete());
      await Promise.all(propSessions.map((s) => s.finish()));
    };
  }
  function lazySession(options = {}) {
    if (options.type !== undefined && options.type !== "single") {
      throw new Error("Cannot use lazy multi sessions!");
    }
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
      const propSession = new PropertySession(storage, ctx, "session", initial);
      const key = await getSessionKey(ctx);
      await propSession.init(key, { custom, lazy: true });
      await next();
      await propSession.finish();
    };
  }

  class PropertySession {
    constructor(storage, obj, prop, initial) {
      this.storage = storage;
      this.obj = obj;
      this.prop = prop;
      this.initial = initial;
      this.fetching = false;
      this.read = false;
      this.wrote = false;
    }
    load() {
      if (this.key === undefined) {
        return;
      }
      if (this.wrote) {
        return;
      }
      if (this.promise === undefined) {
        this.fetching = true;
        this.promise = Promise.resolve(this.storage.read(this.key)).then((val) => {
          var _a;
          this.fetching = false;
          if (this.wrote) {
            return this.value;
          }
          if (val !== undefined) {
            this.value = val;
            return val;
          }
          val = (_a = this.initial) === null || _a === undefined ? undefined : _a.call(this);
          if (val !== undefined) {
            this.wrote = true;
            this.value = val;
          }
          return val;
        });
      }
      return this.promise;
    }
    async init(key, opts) {
      this.key = key;
      if (!opts.lazy)
        await this.load();
      Object.defineProperty(this.obj, this.prop, {
        enumerable: true,
        get: () => {
          if (key === undefined) {
            const msg = undef("access", opts);
            throw new Error(msg);
          }
          this.read = true;
          if (!opts.lazy || this.wrote)
            return this.value;
          this.load();
          return this.fetching ? this.promise : this.value;
        },
        set: (v) => {
          if (key === undefined) {
            const msg = undef("assign", opts);
            throw new Error(msg);
          }
          this.wrote = true;
          this.fetching = false;
          this.value = v;
        }
      });
    }
    delete() {
      Object.assign(this.obj, { [this.prop]: undefined });
    }
    async finish() {
      if (this.key !== undefined) {
        if (this.read)
          await this.load();
        if (this.read || this.wrote) {
          const value = await this.value;
          if (value == null)
            await this.storage.delete(this.key);
          else
            await this.storage.write(this.key, value);
        }
      }
    }
  }
  function fillDefaults(opts = {}) {
    let { prefix = "", getSessionKey = defaultGetSessionKey, initial, storage } = opts;
    if (storage == null) {
      debug("Storing session data in memory, all data will be lost when the bot restarts.");
      storage = new MemorySessionStorage;
    }
    const custom = getSessionKey !== defaultGetSessionKey;
    return {
      initial,
      storage,
      getSessionKey: async (ctx) => {
        const key = await getSessionKey(ctx);
        return key === undefined ? undefined : prefix + key;
      },
      custom
    };
  }
  function defaultGetSessionKey(ctx) {
    var _a;
    return (_a = ctx.chatId) === null || _a === undefined ? undefined : _a.toString();
  }
  function undef(op, opts) {
    const { lazy = false, custom } = opts;
    const reason = custom ? "the custom `getSessionKey` function returned undefined for this update" : "this update does not belong to a chat, so the session key is undefined";
    return `Cannot ${op} ${lazy ? "lazy " : ""}session data because ${reason}!`;
  }
  function isEnhance(value) {
    return value === undefined || typeof value === "object" && value !== null && "__d" in value;
  }
  function enhanceStorage(options) {
    let { storage, millisecondsToLive, migrations } = options;
    storage = compatStorage(storage);
    if (millisecondsToLive !== undefined) {
      storage = timeoutStorage(storage, millisecondsToLive);
    }
    if (migrations !== undefined) {
      storage = migrationStorage(storage, migrations);
    }
    return wrapStorage(storage);
  }
  function compatStorage(storage) {
    return {
      read: async (k) => {
        const v = await storage.read(k);
        return isEnhance(v) ? v : { __d: v };
      },
      write: (k, v) => storage.write(k, v),
      delete: (k) => storage.delete(k)
    };
  }
  function timeoutStorage(storage, millisecondsToLive) {
    const ttlStorage = {
      read: async (k) => {
        const value = await storage.read(k);
        if (value === undefined)
          return;
        if (value.e === undefined) {
          await ttlStorage.write(k, value);
          return value;
        }
        if (value.e < Date.now()) {
          await ttlStorage.delete(k);
          return;
        }
        return value;
      },
      write: async (k, v) => {
        v.e = addExpiryDate(v, millisecondsToLive).expires;
        await storage.write(k, v);
      },
      delete: (k) => storage.delete(k)
    };
    return ttlStorage;
  }
  function migrationStorage(storage, migrations) {
    const versions = Object.keys(migrations).map((v) => parseInt(v)).sort((a, b) => a - b);
    const count = versions.length;
    if (count === 0)
      throw new Error("No migrations given!");
    const earliest = versions[0];
    const last = count - 1;
    const latest = versions[last];
    const index = new Map;
    versions.forEach((v, i) => index.set(v, i));
    function nextAfter(current) {
      let i = last;
      while (current <= versions[i])
        i--;
      return i;
    }
    return {
      read: async (k) => {
        var _a;
        const val = await storage.read(k);
        if (val === undefined)
          return val;
        let { __d: value, v: current = earliest - 1 } = val;
        let i = 1 + ((_a = index.get(current)) !== null && _a !== undefined ? _a : nextAfter(current));
        for (;i < count; i++)
          value = migrations[versions[i]](value);
        return { ...val, v: latest, __d: value };
      },
      write: (k, v) => storage.write(k, { v: latest, ...v }),
      delete: (k) => storage.delete(k)
    };
  }
  function wrapStorage(storage) {
    return {
      read: (k) => Promise.resolve(storage.read(k)).then((v) => v === null || v === undefined ? undefined : v.__d),
      write: (k, v) => storage.write(k, { __d: v }),
      delete: (k) => storage.delete(k)
    };
  }

  class MemorySessionStorage {
    constructor(timeToLive) {
      this.timeToLive = timeToLive;
      this.storage = new Map;
    }
    read(key) {
      const value = this.storage.get(key);
      if (value === undefined)
        return;
      if (value.expires !== undefined && value.expires < Date.now()) {
        this.delete(key);
        return;
      }
      return value.session;
    }
    readAll() {
      return this.readAllValues();
    }
    readAllKeys() {
      return Array.from(this.storage.keys());
    }
    readAllValues() {
      return Array.from(this.storage.keys()).map((key) => this.read(key)).filter((value) => value !== undefined);
    }
    readAllEntries() {
      return Array.from(this.storage.keys()).map((key) => [key, this.read(key)]).filter((pair) => pair[1] !== undefined);
    }
    has(key) {
      return this.storage.has(key);
    }
    write(key, value) {
      this.storage.set(key, addExpiryDate(value, this.timeToLive));
    }
    delete(key) {
      this.storage.delete(key);
    }
  }
  exports.MemorySessionStorage = MemorySessionStorage;
  function addExpiryDate(value, ttl) {
    if (ttl !== undefined && ttl < Infinity) {
      const now = Date.now();
      return { session: value, expires: now + ttl };
    } else {
      return { session: value };
    }
  }
});

// node_modules/grammy/out/convenience/frameworks.js
var require_frameworks = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.adapters = undefined;
  var SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
  var SECRET_HEADER_LOWERCASE = SECRET_HEADER.toLowerCase();
  var WRONG_TOKEN_ERROR = "secret token is wrong";
  var ok = () => new Response(null, { status: 200 });
  var okJson = (json) => new Response(json, {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  var unauthorized = () => new Response('"unauthorized"', {
    status: 401,
    statusText: WRONG_TOKEN_ERROR
  });
  var awsLambda = (event, _context, callback) => ({
    get update() {
      var _a;
      return JSON.parse((_a = event.body) !== null && _a !== undefined ? _a : "{}");
    },
    header: event.headers[SECRET_HEADER],
    end: () => callback(null, { statusCode: 200 }),
    respond: (json) => callback(null, {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: json
    }),
    unauthorized: () => callback(null, { statusCode: 401 })
  });
  var awsLambdaAsync = (event, _context) => {
    let resolveResponse;
    return {
      get update() {
        var _a;
        return JSON.parse((_a = event.body) !== null && _a !== undefined ? _a : "{}");
      },
      header: event.headers[SECRET_HEADER],
      end: () => resolveResponse({ statusCode: 200 }),
      respond: (json) => resolveResponse({
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: json
      }),
      unauthorized: () => resolveResponse({ statusCode: 401 }),
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var azure = (context, request) => {
    var _a, _b;
    return {
      get update() {
        return request.body;
      },
      header: (_b = (_a = context.res) === null || _a === undefined ? undefined : _a.headers) === null || _b === undefined ? undefined : _b[SECRET_HEADER],
      end: () => context.res = {
        status: 200,
        body: ""
      },
      respond: (json) => {
        var _a2, _b2, _c, _d;
        (_b2 = (_a2 = context.res) === null || _a2 === undefined ? undefined : _a2.set) === null || _b2 === undefined || _b2.call(_a2, "Content-Type", "application/json");
        (_d = (_c = context.res) === null || _c === undefined ? undefined : _c.send) === null || _d === undefined || _d.call(_c, json);
      },
      unauthorized: () => {
        var _a2, _b2;
        (_b2 = (_a2 = context.res) === null || _a2 === undefined ? undefined : _a2.send) === null || _b2 === undefined || _b2.call(_a2, 401, WRONG_TOKEN_ERROR);
      }
    };
  };
  var azureV4 = (request) => {
    let resolveResponse;
    return {
      get update() {
        return request.json();
      },
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => resolveResponse({ status: 204 }),
      respond: (json) => resolveResponse({ jsonBody: json }),
      unauthorized: () => resolveResponse({ status: 401, body: WRONG_TOKEN_ERROR }),
      handlerReturn: new Promise((resolve) => resolveResponse = resolve)
    };
  };
  var bun = (request) => {
    let resolveResponse;
    return {
      get update() {
        return request.json();
      },
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var cloudflare = (event) => {
    let resolveResponse;
    event.respondWith(new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    return {
      get update() {
        return event.request.json();
      },
      header: event.request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      }
    };
  };
  var cloudflareModule = (request) => {
    let resolveResponse;
    return {
      get update() {
        return request.json();
      },
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var express = (req, res) => ({
    get update() {
      return req.body;
    },
    header: req.header(SECRET_HEADER),
    end: () => res.end(),
    respond: (json) => {
      res.set("Content-Type", "application/json");
      res.send(json);
    },
    unauthorized: () => {
      res.status(401).send(WRONG_TOKEN_ERROR);
    }
  });
  var fastify = (request, reply) => ({
    get update() {
      return request.body;
    },
    header: request.headers[SECRET_HEADER_LOWERCASE],
    end: () => reply.send(""),
    respond: (json) => reply.headers({ "Content-Type": "application/json" }).send(json),
    unauthorized: () => reply.code(401).send(WRONG_TOKEN_ERROR)
  });
  var hono = (c) => {
    let resolveResponse;
    return {
      get update() {
        return c.req.json();
      },
      header: c.req.header(SECRET_HEADER),
      end: () => {
        resolveResponse(c.body(""));
      },
      respond: (json) => {
        resolveResponse(c.json(json));
      },
      unauthorized: () => {
        c.status(401);
        resolveResponse(c.body(""));
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var http = (req, res) => {
    const secretHeaderFromRequest = req.headers[SECRET_HEADER_LOWERCASE];
    return {
      get update() {
        return new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk)).once("end", () => {
            const raw = Buffer.concat(chunks).toString("utf-8");
            resolve(JSON.parse(raw));
          }).once("error", reject);
        });
      },
      header: Array.isArray(secretHeaderFromRequest) ? secretHeaderFromRequest[0] : secretHeaderFromRequest,
      end: () => res.end(),
      respond: (json) => res.writeHead(200, { "Content-Type": "application/json" }).end(json),
      unauthorized: () => res.writeHead(401).end(WRONG_TOKEN_ERROR)
    };
  };
  var koa = (ctx) => ({
    get update() {
      return ctx.request.body;
    },
    header: ctx.get(SECRET_HEADER) || undefined,
    end: () => {
      ctx.body = "";
    },
    respond: (json) => {
      ctx.set("Content-Type", "application/json");
      ctx.response.body = json;
    },
    unauthorized: () => {
      ctx.status = 401;
    }
  });
  var nextJs = (request, response) => ({
    get update() {
      return request.body;
    },
    header: request.headers[SECRET_HEADER_LOWERCASE],
    end: () => response.end(),
    respond: (json) => response.status(200).json(json),
    unauthorized: () => response.status(401).send(WRONG_TOKEN_ERROR)
  });
  var nhttp = (rev) => ({
    get update() {
      return rev.body;
    },
    header: rev.headers.get(SECRET_HEADER) || undefined,
    end: () => rev.response.sendStatus(200),
    respond: (json) => rev.response.status(200).send(json),
    unauthorized: () => rev.response.status(401).send(WRONG_TOKEN_ERROR)
  });
  var oak = (ctx) => ({
    get update() {
      return ctx.request.body.json();
    },
    header: ctx.request.headers.get(SECRET_HEADER) || undefined,
    end: () => {
      ctx.response.status = 200;
    },
    respond: (json) => {
      ctx.response.type = "json";
      ctx.response.body = json;
    },
    unauthorized: () => {
      ctx.response.status = 401;
    }
  });
  var serveHttp = (requestEvent) => ({
    get update() {
      return requestEvent.request.json();
    },
    header: requestEvent.request.headers.get(SECRET_HEADER) || undefined,
    end: () => requestEvent.respondWith(ok()),
    respond: (json) => requestEvent.respondWith(okJson(json)),
    unauthorized: () => requestEvent.respondWith(unauthorized())
  });
  var stdHttp = (req) => {
    let resolveResponse;
    return {
      get update() {
        return req.json();
      },
      header: req.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        if (resolveResponse)
          resolveResponse(ok());
      },
      respond: (json) => {
        if (resolveResponse)
          resolveResponse(okJson(json));
      },
      unauthorized: () => {
        if (resolveResponse)
          resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var sveltekit = ({ request }) => {
    let resolveResponse;
    return {
      get update() {
        return request.json();
      },
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        if (resolveResponse)
          resolveResponse(ok());
      },
      respond: (json) => {
        if (resolveResponse)
          resolveResponse(okJson(json));
      },
      unauthorized: () => {
        if (resolveResponse)
          resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  var worktop = (req, res) => {
    var _a;
    return {
      get update() {
        return req.json();
      },
      header: (_a = req.headers.get(SECRET_HEADER)) !== null && _a !== undefined ? _a : undefined,
      end: () => res.end(null),
      respond: (json) => res.send(200, json),
      unauthorized: () => res.send(401, WRONG_TOKEN_ERROR)
    };
  };
  var elysia = (ctx) => {
    let resolveResponse;
    return {
      get update() {
        return ctx.body;
      },
      header: ctx.headers[SECRET_HEADER_LOWERCASE],
      end() {
        resolveResponse("");
      },
      respond(json) {
        ctx.set.headers["content-type"] = "application/json";
        resolveResponse(json);
      },
      unauthorized() {
        ctx.set.status = 401;
        resolveResponse("");
      },
      handlerReturn: new Promise((res) => resolveResponse = res)
    };
  };
  exports.adapters = {
    "aws-lambda": awsLambda,
    "aws-lambda-async": awsLambdaAsync,
    azure,
    "azure-v4": azureV4,
    bun,
    cloudflare,
    "cloudflare-mod": cloudflareModule,
    elysia,
    express,
    fastify,
    hono,
    http,
    https: http,
    koa,
    "next-js": nextJs,
    nhttp,
    oak,
    serveHttp,
    "std/http": stdHttp,
    sveltekit,
    worktop
  };
});

// node_modules/grammy/out/convenience/webhook.js
var require_webhook = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.webhookCallback = webhookCallback;
  var platform_node_js_1 = require_platform_node();
  var frameworks_js_1 = require_frameworks();
  var debugErr = (0, platform_node_js_1.debug)("grammy:error");
  var callbackAdapter = (update, callback, header, unauthorized = () => callback('"unauthorized"')) => ({
    update: Promise.resolve(update),
    respond: callback,
    header,
    unauthorized
  });
  var adapters = { ...frameworks_js_1.adapters, callback: callbackAdapter };
  function compareSecretToken(header, token) {
    if (token === undefined) {
      return true;
    }
    if (header === undefined) {
      return false;
    }
    const encoder = new TextEncoder;
    const headerBytes = encoder.encode(header);
    const tokenBytes = encoder.encode(token);
    if (headerBytes.length !== tokenBytes.length) {
      return false;
    }
    let hasDifference = 0;
    for (let i = 0;i < tokenBytes.length; i++) {
      const headerByte = i < headerBytes.length ? headerBytes[i] : 0;
      const tokenByte = tokenBytes[i];
      hasDifference |= headerByte ^ tokenByte;
    }
    return hasDifference === 0;
  }
  function webhookCallback(bot, adapter = platform_node_js_1.defaultAdapter, onTimeout, timeoutMilliseconds, secretToken) {
    if (bot.isRunning()) {
      throw new Error("Bot is already running via long polling, the webhook setup won't receive any updates!");
    } else {
      bot.start = () => {
        throw new Error("You already started the bot via webhooks, calling `bot.start()` starts the bot with long polling and this will prevent your webhook setup from receiving any updates!");
      };
    }
    const { onTimeout: timeout = "throw", timeoutMilliseconds: ms = 1e4, secretToken: token } = typeof onTimeout === "object" ? onTimeout : { onTimeout, timeoutMilliseconds, secretToken };
    let initialized = false;
    const server = typeof adapter === "string" ? adapters[adapter] : adapter;
    return async (...args) => {
      var _a;
      const handler = server(...args);
      if (!initialized) {
        await bot.init();
        initialized = true;
      }
      if (!compareSecretToken(handler.header, token)) {
        await handler.unauthorized();
        return handler.handlerReturn;
      }
      let usedWebhookReply = false;
      const webhookReplyEnvelope = {
        async send(json) {
          usedWebhookReply = true;
          await handler.respond(json);
        }
      };
      await timeoutIfNecessary(bot.handleUpdate(await handler.update, webhookReplyEnvelope), typeof timeout === "function" ? () => timeout(...args) : timeout, ms);
      if (!usedWebhookReply)
        (_a = handler.end) === null || _a === undefined || _a.call(handler);
      return handler.handlerReturn;
    };
  }
  function timeoutIfNecessary(task, onTimeout, timeout) {
    if (timeout === Infinity)
      return task;
    return new Promise((resolve, reject) => {
      const handle = setTimeout(() => {
        debugErr(`Request timed out after ${timeout} ms`);
        if (onTimeout === "throw") {
          reject(new Error(`Request timed out after ${timeout} ms`));
        } else {
          if (typeof onTimeout === "function")
            onTimeout();
          resolve();
        }
        const now = Date.now();
        task.finally(() => {
          const diff = Date.now() - now;
          debugErr(`Request completed ${diff} ms after timeout!`);
        });
      }, timeout);
      task.then(resolve).catch(reject).finally(() => clearTimeout(handle));
    });
  }
});

// node_modules/grammy/out/mod.js
var require_mod = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.HttpError = exports.GrammyError = exports.Api = exports.matchFilter = exports.Composer = exports.Context = exports.InputFile = exports.BotError = exports.Bot = undefined;
  var bot_js_1 = require_bot();
  Object.defineProperty(exports, "Bot", { enumerable: true, get: function() {
    return bot_js_1.Bot;
  } });
  Object.defineProperty(exports, "BotError", { enumerable: true, get: function() {
    return bot_js_1.BotError;
  } });
  var types_js_1 = require_types();
  Object.defineProperty(exports, "InputFile", { enumerable: true, get: function() {
    return types_js_1.InputFile;
  } });
  var context_js_1 = require_context();
  Object.defineProperty(exports, "Context", { enumerable: true, get: function() {
    return context_js_1.Context;
  } });
  __exportStar(require_constants(), exports);
  __exportStar(require_inline_query(), exports);
  __exportStar(require_input_media(), exports);
  __exportStar(require_keyboard(), exports);
  __exportStar(require_session(), exports);
  __exportStar(require_webhook(), exports);
  var composer_js_1 = require_composer();
  Object.defineProperty(exports, "Composer", { enumerable: true, get: function() {
    return composer_js_1.Composer;
  } });
  var filter_js_1 = require_filter();
  Object.defineProperty(exports, "matchFilter", { enumerable: true, get: function() {
    return filter_js_1.matchFilter;
  } });
  var api_js_1 = require_api();
  Object.defineProperty(exports, "Api", { enumerable: true, get: function() {
    return api_js_1.Api;
  } });
  var error_js_1 = require_error();
  Object.defineProperty(exports, "GrammyError", { enumerable: true, get: function() {
    return error_js_1.GrammyError;
  } });
  Object.defineProperty(exports, "HttpError", { enumerable: true, get: function() {
    return error_js_1.HttpError;
  } });
});

// src/database.ts
import { Database } from "bun:sqlite";

// src/config.ts
function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
function optionalEnv(key, fallback) {
  return process.env[key] || fallback;
}
function loadConfig() {
  return {
    telegram_bot_token: requireEnv("TELEGRAM_BOT_TOKEN"),
    telegram_chat_id: requireEnv("TELEGRAM_CHAT_ID"),
    oxr_app_id: requireEnv("OXR_APP_ID"),
    poll_interval_minutes: parseInt(optionalEnv("POLL_INTERVAL_MINUTES", "60")),
    alert_threshold_percent: parseFloat(optionalEnv("ALERT_THRESHOLD_PERCENT", "0.15")),
    trend_decline_days: parseInt(optionalEnv("TREND_DECLINE_DAYS", "3")),
    salary_day: parseInt(optionalEnv("SALARY_DAY", "0")),
    timezone: optionalEnv("TZ", "America/Mexico_City"),
    default_salary_usd: parseFloat(optionalEnv("DEFAULT_SALARY_USD", "6000")),
    default_commission: parseFloat(optionalEnv("DEFAULT_COMMISSION", "0.10"))
  };
}
function isLastWeekOfMonth() {
  const now = new Date;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() >= lastDay - 7;
}
function getCurrentMonth() {
  const now = new Date;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// src/database.ts
var db;
function initDatabase(dbPath = "data/dollar-check.db") {
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir) {
    const fs = __require("fs");
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'openexchangerates',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS salary_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      amount_usd REAL NOT NULL,
      amount_mxn REAL NOT NULL,
      commission_per_dollar REAL NOT NULL DEFAULT 0.10,
      effective_rate REAL NOT NULL,
      exchanged_at TEXT NOT NULL DEFAULT (datetime('now')),
      month TEXT NOT NULL,
      notes TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS monthly_state (
      current_month TEXT PRIMARY KEY,
      is_exchanged INTEGER NOT NULL DEFAULT 0,
      last_exchange_rate REAL,
      last_exchange_date TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_rates_timestamp
    ON exchange_rates(timestamp DESC)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_rates_created
    ON exchange_rates(created_at DESC)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_salary_month
    ON salary_exchanges(month DESC)
  `);
  return db;
}
function getDb() {
  if (!db)
    throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}
function saveRate(rate, timestamp, source = "openexchangerates") {
  getDb().prepare("INSERT INTO exchange_rates (rate, timestamp, source) VALUES (?, ?, ?)").run(rate, timestamp, source);
}
function getLatestRate() {
  return getDb().prepare("SELECT * FROM exchange_rates ORDER BY timestamp DESC LIMIT 1").get();
}
function getDailyRates(days) {
  return getDb().prepare(`
      SELECT
        date(created_at) as date,
        AVG(rate) as avg_rate,
        MIN(rate) as min_rate,
        MAX(rate) as max_rate
      FROM exchange_rates
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all(days);
}
function saveSalaryExchange(exchange) {
  getDb().prepare(`
      INSERT INTO salary_exchanges
        (rate, amount_usd, amount_mxn, commission_per_dollar, effective_rate, exchanged_at, month, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(exchange.rate, exchange.amount_usd, exchange.amount_mxn, exchange.commission_per_dollar, exchange.effective_rate, exchange.exchanged_at, exchange.month, exchange.notes || null);
}
function getLastSalaryExchange() {
  return getDb().prepare("SELECT * FROM salary_exchanges ORDER BY exchanged_at DESC LIMIT 1").get();
}
function getSalaryExchangeHistory(limit = 12) {
  return getDb().prepare("SELECT * FROM salary_exchanges ORDER BY exchanged_at DESC LIMIT ?").all(limit);
}
function getExchangeStats() {
  const stats = getDb().prepare(`
      SELECT
        COUNT(*) as total_exchanges,
        AVG(effective_rate) as avg_rate,
        MAX(effective_rate) as best_rate,
        MIN(effective_rate) as worst_rate,
        SUM(amount_usd) as total_usd_exchanged,
        SUM(amount_mxn) as total_mxn_received
      FROM salary_exchanges
    `).get();
  if (!stats || stats.total_exchanges === 0)
    return null;
  const best = getDb().prepare("SELECT month FROM salary_exchanges ORDER BY effective_rate DESC LIMIT 1").get();
  const worst = getDb().prepare("SELECT month FROM salary_exchanges ORDER BY effective_rate ASC LIMIT 1").get();
  const avgMxn = stats.avg_rate * stats.total_usd_exchanged;
  const potentialDiff = stats.total_mxn_received - avgMxn;
  return {
    ...stats,
    best_month: best?.month || "N/A",
    worst_month: worst?.month || "N/A",
    potential_gain_loss_vs_avg: potentialDiff
  };
}
function getMonthlyState() {
  const month = getCurrentMonth();
  let state = getDb().prepare("SELECT * FROM monthly_state WHERE current_month = ?").get(month);
  if (!state) {
    const lastExchange = getLastSalaryExchange();
    const lastRate = lastExchange?.effective_rate || 0;
    const lastDate = lastExchange?.exchanged_at || "";
    getDb().prepare(`
        INSERT INTO monthly_state (current_month, is_exchanged, last_exchange_rate, last_exchange_date)
        VALUES (?, 0, ?, ?)
      `).run(month, lastRate, lastDate);
    state = {
      current_month: month,
      is_exchanged: 0,
      last_exchange_rate: lastRate,
      last_exchange_date: lastDate
    };
  }
  return {
    is_exchanged: !!state.is_exchanged,
    last_exchange_rate: state.last_exchange_rate || 0,
    last_exchange_date: state.last_exchange_date || "",
    current_month: state.current_month
  };
}
function markMonthAsExchanged(rate) {
  const month = getCurrentMonth();
  getDb().prepare(`
      UPDATE monthly_state
      SET is_exchanged = 1, last_exchange_rate = ?, last_exchange_date = datetime('now')
      WHERE current_month = ?
    `).run(rate, month);
}
function getSetting(key) {
  const row = getDb().prepare("SELECT value FROM bot_settings WHERE key = ?").get(key);
  return row?.value || null;
}
function setSetting(key, value) {
  getDb().prepare(`
      INSERT INTO bot_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, value, value);
}

// src/exchange.ts
async function fetchCurrentRate(appId) {
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=MXN`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OXR API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const rate = data.rates.MXN;
    if (!rate || rate <= 0) {
      throw new Error(`Invalid MXN rate received: ${rate}`);
    }
    saveRate(rate, data.timestamp);
    console.log(`[Exchange] USD/MXN: ${rate.toFixed(4)} (${new Date(data.timestamp * 1000).toISOString()})`);
    return rate;
  } catch (error) {
    console.error("[Exchange] Failed to fetch rate:", error);
    const lastRate = getLatestRate();
    if (lastRate) {
      console.log(`[Exchange] Using cached rate: ${lastRate.rate}`);
      return lastRate.rate;
    }
    throw error;
  }
}

// src/stats.ts
function sma(values, period) {
  if (values.length === 0)
    return 0;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}
function ema(values, period) {
  if (values.length === 0)
    return 0;
  const k = 2 / (period + 1);
  let emaValue = values[0];
  for (let i = 1;i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}
function standardDeviation(values) {
  if (values.length < 2)
    return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}
function momentum(values, period) {
  if (values.length < period + 1)
    return 0;
  const current = values[values.length - 1];
  const past = values[values.length - 1 - period];
  return (current - past) / past * 100;
}
function consecutiveDirection(dailyRates) {
  if (dailyRates.length < 2)
    return { direction: "sideways", count: 0 };
  let count = 0;
  let direction = "sideways";
  for (let i = 0;i < dailyRates.length - 1; i++) {
    const current = dailyRates[i].avg_rate;
    const previous = dailyRates[i + 1].avg_rate;
    const diff = current - previous;
    if (Math.abs(diff) < 0.01) {
      if (count === 0) {
        direction = "sideways";
        count++;
        continue;
      }
      break;
    }
    const currentDir = diff > 0 ? "up" : "down";
    if (count === 0) {
      direction = currentDir;
      count = 1;
    } else if (currentDir === direction) {
      count++;
    } else {
      break;
    }
  }
  return { direction, count };
}
function generateRecommendation(currentRate, lastExchangeRate, changePercent, trend, consecutiveDays, momentumValue, volatility, thresholdPercent) {
  if (lastExchangeRate === 0)
    return "hold";
  const isAboveLastExchange = currentRate > lastExchangeRate;
  if (isAboveLastExchange && changePercent >= thresholdPercent * 3 && momentumValue > 0) {
    return "strong_buy";
  }
  if (isAboveLastExchange && changePercent >= thresholdPercent) {
    if (momentumValue < 0 && trend === "down") {
      return "buy";
    }
    return "buy";
  }
  if (trend === "down" && consecutiveDays >= 3 && !isAboveLastExchange) {
    return "change_now";
  }
  if (trend === "down" && isAboveLastExchange) {
    return "buy";
  }
  if (trend === "down" && consecutiveDays >= 2) {
    return "watch";
  }
  return "hold";
}
function analyzeTrend(thresholdPercent) {
  const dailyRates = getDailyRates(30);
  const latestRate = getLatestRate();
  const lastExchange = getLastSalaryExchange();
  if (!latestRate || dailyRates.length === 0) {
    return {
      direction: "sideways",
      consecutive_days: 0,
      change_percent: 0,
      sma_7: 0,
      sma_30: 0,
      ema_7: 0,
      volatility: 0,
      momentum: 0,
      recommendation: "hold"
    };
  }
  const avgRates = dailyRates.map((d) => d.avg_rate).reverse();
  const currentRate = latestRate.rate;
  const lastExchangeRate = lastExchange?.effective_rate || 0;
  const changePercent = lastExchangeRate > 0 ? (currentRate - lastExchangeRate) / lastExchangeRate * 100 : 0;
  const { direction, count } = consecutiveDirection(dailyRates);
  const sma7 = sma(avgRates, 7);
  const sma30 = sma(avgRates, 30);
  const ema7 = ema(avgRates, 7);
  const vol = standardDeviation(avgRates.slice(-7));
  const mom = momentum(avgRates, 5);
  const recommendation = generateRecommendation(currentRate, lastExchangeRate, Math.abs(changePercent), direction, count, mom, vol, thresholdPercent);
  return {
    direction,
    consecutive_days: count,
    change_percent: changePercent,
    sma_7: sma7,
    sma_30: sma30,
    ema_7: ema7,
    volatility: vol,
    momentum: mom,
    recommendation
  };
}
function formatTrendMessage(trend, currentRate, lastExchangeRate, commission) {
  const effectiveRate = currentRate - commission;
  const diffFromLast = lastExchangeRate > 0 ? effectiveRate - lastExchangeRate : 0;
  const diffMxn = diffFromLast * 6000;
  const dirEmoji = trend.direction === "up" ? "\uD83D\uDCC8" : trend.direction === "down" ? "\uD83D\uDCC9" : "\u27A1\uFE0F";
  const recEmoji = {
    strong_buy: "\uD83D\uDFE2\uD83D\uDFE2",
    buy: "\uD83D\uDFE2",
    hold: "\uD83D\uDFE1",
    watch: "\uD83D\uDFE0",
    change_now: "\uD83D\uDD34"
  };
  const recLabel = {
    strong_buy: "\xA1EXCELENTE momento para cambiar!",
    buy: "Buen momento para cambiar",
    hold: "Mantener, sin urgencia",
    watch: "Vigilar de cerca, tendencia bajista",
    change_now: "\u26A0\uFE0F Cambiar YA, ca\xEDda sostenida"
  };
  let msg = `\uD83D\uDCB1 *USD/MXN Status*

`;
  msg += `Tasa actual: *$${currentRate.toFixed(4)}*
`;
  msg += `Tasa efectiva (-comisi\xF3n): *$${effectiveRate.toFixed(4)}*

`;
  if (lastExchangeRate > 0) {
    msg += `\xDAltimo cambio: $${lastExchangeRate.toFixed(4)}
`;
    msg += `Diferencia: ${diffFromLast >= 0 ? "+" : ""}${diffFromLast.toFixed(4)} (${trend.change_percent >= 0 ? "+" : ""}${trend.change_percent.toFixed(2)}%)
`;
    msg += `Impacto en $6,000 USD: ${diffMxn >= 0 ? "+" : ""}$${diffMxn.toFixed(0)} MXN

`;
  }
  msg += `${dirEmoji} Tendencia: ${trend.direction} (${trend.consecutive_days} d\xEDas)
`;
  msg += `SMA 7d: $${trend.sma_7.toFixed(4)} | SMA 30d: $${trend.sma_30.toFixed(4)}
`;
  msg += `Volatilidad: ${trend.volatility.toFixed(4)} | Momentum: ${trend.momentum >= 0 ? "+" : ""}${trend.momentum.toFixed(2)}%

`;
  msg += `${recEmoji[trend.recommendation] || "\u26AA"} *${recLabel[trend.recommendation] || "Sin datos suficientes"}*`;
  return msg;
}

// src/alerts.ts
function evaluateAlerts(config) {
  const latestRate = getLatestRate();
  const monthlyState = getMonthlyState();
  const lastExchange = getLastSalaryExchange();
  const trend = analyzeTrend(config.alert_threshold_percent);
  const alerts = [];
  if (!latestRate) {
    return { shouldNotify: false, alerts: [], fullMessage: "" };
  }
  const currentRate = latestRate.rate;
  const effectiveRate = currentRate - config.default_commission;
  const lastExchangeRate = lastExchange?.effective_rate || 0;
  if (monthlyState.is_exchanged) {
    return {
      shouldNotify: false,
      alerts: [],
      fullMessage: "Ya cambiaste tu sueldo este mes. Alertas pausadas."
    };
  }
  if (lastExchangeRate > 0) {
    const changePercent = (effectiveRate - lastExchangeRate) / lastExchangeRate * 100;
    if (changePercent >= config.alert_threshold_percent) {
      const impactMxn = (effectiveRate - lastExchangeRate) * config.default_salary_usd;
      alerts.push({
        type: "threshold_up",
        triggered: true,
        message: `\uD83D\uDCC8 *\xA1D\xF3lar arriba!*
` + `Tasa efectiva: $${effectiveRate.toFixed(4)} vs \xFAltimo cambio $${lastExchangeRate.toFixed(4)}
` + `Mejora: +${changePercent.toFixed(2)}% \u2192 +$${impactMxn.toFixed(0)} MXN en tu sueldo`,
        rate: currentRate,
        change_percent: changePercent
      });
    }
    if (trend.direction === "down" && trend.consecutive_days >= config.trend_decline_days) {
      alerts.push({
        type: "trend_decline",
        triggered: true,
        message: `\uD83D\uDCC9 *Tendencia bajista sostenida*
` + `${trend.consecutive_days} d\xEDas consecutivos a la baja
` + `Momentum: ${trend.momentum.toFixed(2)}%
` + `${effectiveRate > lastExchangeRate ? "A\xFAn est\xE1s por encima de tu \xFAltimo cambio, pero la tendencia no es favorable." : "\u26A0\uFE0F Ya est\xE1s por debajo de tu \xFAltimo cambio. Considera cambiar pronto."}`,
        rate: currentRate,
        change_percent: (effectiveRate - lastExchangeRate) / lastExchangeRate * 100
      });
    }
  }
  if (isLastWeekOfMonth() && lastExchangeRate > 0) {
    const changePercent = (effectiveRate - lastExchangeRate) / lastExchangeRate * 100;
    if (Math.abs(changePercent) >= config.alert_threshold_percent * 0.5 && !alerts.some((a) => a.type === "threshold_up")) {
      alerts.push({
        type: "daily_summary",
        triggered: true,
        message: `\uD83D\uDCC5 *\xDAltima semana del mes*
` + `Tu sueldo llega pronto. Tasa efectiva: $${effectiveRate.toFixed(4)}
` + `vs \xFAltimo cambio: $${lastExchangeRate.toFixed(4)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%)`,
        rate: currentRate,
        change_percent: changePercent
      });
    }
  }
  if (alerts.length === 0) {
    return { shouldNotify: false, alerts, fullMessage: "" };
  }
  let fullMessage = alerts.map((a) => a.message).join(`

---

`);
  fullMessage += `

${formatTrendMessage(trend, currentRate, lastExchangeRate, config.default_commission)}`;
  return {
    shouldNotify: true,
    alerts,
    fullMessage
  };
}

// src/bot.ts
var import_grammy = __toESM(require_mod(), 1);
function createBot(config) {
  const bot = new import_grammy.Bot(config.telegram_bot_token);
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id.toString() !== config.telegram_chat_id) {
      await ctx.reply("\u26D4 No autorizado.");
      return;
    }
    await next();
  });
  bot.command("start", async (ctx) => {
    await ctx.reply(`\uD83E\uDD11 *Dollar Check Bot*

` + `Te ayudo a encontrar el mejor momento para cambiar tu sueldo de USD a MXN.

` + `*Comandos disponibles:*
` + `/status - Tasa actual, tendencia y recomendaci\xF3n
` + `/changed <tasa> - Registrar que cambiaste tu sueldo
` + `/history - Historial de cambios
` + `/stats - Estad\xEDsticas acumuladas
` + `/month - Resumen del mes actual
` + `/config - Ver configuraci\xF3n actual
` + `/set\\_threshold <porcentaje> - Cambiar umbral de alerta
` + `/set\\_commission <monto> - Cambiar comisi\xF3n por d\xF3lar
` + `/set\\_salary <monto> - Cambiar monto de sueldo en USD
` + `/refresh - Consultar tasa ahora mismo
` + `/help - Mostrar esta ayuda`, { parse_mode: "Markdown" });
  });
  bot.command("help", async (ctx) => {
    await ctx.api.sendMessage(ctx.chat.id, `\uD83E\uDD11 *Dollar Check Bot - Ayuda*

` + `*Comandos disponibles:*
` + `/status - Tasa actual, tendencia y recomendaci\xF3n
` + `/changed <tasa> - Registrar que cambiaste tu sueldo
` + `/history - Historial de cambios
` + `/stats - Estad\xEDsticas acumuladas
` + `/month - Resumen del mes actual
` + `/config - Ver configuraci\xF3n actual
` + `/set\\_threshold <porcentaje> - Cambiar umbral de alerta
` + `/set\\_commission <monto> - Cambiar comisi\xF3n por d\xF3lar
` + `/set\\_salary <monto> - Cambiar monto de sueldo en USD
` + `/refresh - Consultar tasa ahora mismo
` + `/help - Mostrar esta ayuda`, { parse_mode: "Markdown" });
  });
  bot.command("status", async (ctx) => {
    const latestRate = getLatestRate();
    const monthlyState = getMonthlyState();
    const lastExchange = getLastSalaryExchange();
    const trend = analyzeTrend(config.alert_threshold_percent);
    if (!latestRate) {
      await ctx.reply("\u23F3 A\xFAn no tengo datos. Espera al primer polling o usa /refresh");
      return;
    }
    const lastRate = lastExchange?.effective_rate || 0;
    let msg = formatTrendMessage(trend, latestRate.rate, lastRate, config.default_commission);
    if (monthlyState.is_exchanged) {
      msg += `

\u2705 Ya cambiaste tu sueldo este mes. Alertas pausadas.`;
    } else {
      msg += `

\u23F3 Pendiente de cambiar este mes.`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });
  bot.command("refresh", async (ctx) => {
    try {
      await ctx.reply("\uD83D\uDD04 Consultando tasa actual...");
      const rate = await fetchCurrentRate(config.oxr_app_id);
      const effectiveRate = rate - config.default_commission;
      const lastExchange = getLastSalaryExchange();
      const lastRate = lastExchange?.effective_rate || 0;
      let diff = "";
      if (lastRate > 0) {
        const change = effectiveRate - lastRate;
        const pct = (change / lastRate * 100).toFixed(2);
        const impact = (change * config.default_salary_usd).toFixed(0);
        diff = `
Vs \xFAltimo cambio: ${change >= 0 ? "+" : ""}${change.toFixed(4)} (${pct}%) \u2192 ${change >= 0 ? "+" : ""}$${impact} MXN`;
      }
      await ctx.reply(`\uD83D\uDCB1 *Tasa actual*
USD/MXN: $${rate.toFixed(4)}
Efectiva: $${effectiveRate.toFixed(4)}${diff}`, { parse_mode: "Markdown" });
    } catch (error) {
      await ctx.reply(`\u274C Error al consultar: ${error}`);
    }
  });
  bot.command("changed", async (ctx) => {
    const args = ctx.message?.text?.split(" ").slice(1) || [];
    const rate = parseFloat(args[0]);
    const amountUsd = parseFloat(args[1]) || config.default_salary_usd;
    if (isNaN(rate) || rate <= 0) {
      await ctx.reply("Uso: `/changed <tasa> [monto_usd]`\n" + "Ejemplo: `/changed 17.30` o `/changed 17.30 6000`", { parse_mode: "Markdown" });
      return;
    }
    const effectiveRate = rate - config.default_commission;
    const amountMxn = amountUsd * effectiveRate;
    saveSalaryExchange({
      rate,
      amount_usd: amountUsd,
      amount_mxn: amountMxn,
      commission_per_dollar: config.default_commission,
      effective_rate: effectiveRate,
      exchanged_at: new Date().toISOString(),
      month: getCurrentMonth(),
      notes: null
    });
    markMonthAsExchanged(effectiveRate);
    await ctx.reply(`\u2705 *Cambio registrado*

` + `Tasa: $${rate.toFixed(4)}
` + `Comisi\xF3n: -$${config.default_commission.toFixed(2)}/USD
` + `Tasa efectiva: $${effectiveRate.toFixed(4)}
` + `Monto: $${amountUsd.toLocaleString()} USD
` + `Recibiste: $${amountMxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN

` + `Alertas pausadas hasta el pr\xF3ximo mes. \uD83D\uDD15`, { parse_mode: "Markdown" });
  });
  bot.command("history", async (ctx) => {
    const history = getSalaryExchangeHistory(12);
    if (history.length === 0) {
      await ctx.reply("\uD83D\uDCED No hay historial de cambios a\xFAn. Usa /changed cuando hagas tu primer cambio.");
      return;
    }
    let msg = `\uD83D\uDCCA *Historial de cambios*

`;
    msg += `| Mes | Tasa Ef. | MXN Recibido |
`;
    msg += `|-----|----------|-------------|
`;
    for (const ex of history) {
      msg += `| ${ex.month} | $${ex.effective_rate.toFixed(2)} | $${ex.amount_mxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })} |
`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });
  bot.command("stats", async (ctx) => {
    const stats = getExchangeStats();
    if (!stats) {
      await ctx.reply("\uD83D\uDCED No hay suficientes datos para estad\xEDsticas.");
      return;
    }
    const avgMxnPerMonth = stats.total_mxn_received / stats.total_exchanges;
    await ctx.reply(`\uD83D\uDCC8 *Estad\xEDsticas acumuladas*

` + `Total de cambios: ${stats.total_exchanges}
` + `Tasa promedio efectiva: $${stats.avg_rate.toFixed(4)}
` + `Mejor tasa: $${stats.best_rate.toFixed(4)} (${stats.best_month})
` + `Peor tasa: $${stats.worst_rate.toFixed(4)} (${stats.worst_month})

` + `Total USD cambiados: $${stats.total_usd_exchanged.toLocaleString()}
` + `Total MXN recibidos: $${stats.total_mxn_received.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
` + `Promedio MXN/mes: $${avgMxnPerMonth.toLocaleString("es-MX", { minimumFractionDigits: 0 })}

` + `${stats.potential_gain_loss_vs_avg >= 0 ? "\uD83D\uDCC8" : "\uD83D\uDCC9"} Vs promedio plano: ${stats.potential_gain_loss_vs_avg >= 0 ? "+" : ""}$${stats.potential_gain_loss_vs_avg.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN`, { parse_mode: "Markdown" });
  });
  bot.command("month", async (ctx) => {
    const dailyRates = getDailyRates(30);
    const monthlyState = getMonthlyState();
    if (dailyRates.length === 0) {
      await ctx.reply("\uD83D\uDCED No hay datos del mes actual.");
      return;
    }
    const rates = dailyRates.map((d) => d.avg_rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    let msg = `\uD83D\uDCC5 *Resumen del mes (${monthlyState.current_month})*

`;
    msg += `D\xEDas con datos: ${dailyRates.length}
`;
    msg += `Tasa promedio: $${avg.toFixed(4)}
`;
    msg += `M\xEDnima: $${min.toFixed(4)}
`;
    msg += `M\xE1xima: $${max.toFixed(4)}
`;
    msg += `Rango: $${(max - min).toFixed(4)}

`;
    msg += monthlyState.is_exchanged ? `\u2705 Sueldo ya cambiado este mes` : `\u23F3 Sueldo pendiente de cambiar`;
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });
  bot.command("config", async (ctx) => {
    await ctx.reply(`\u2699\uFE0F *Configuraci\xF3n actual*

` + `Umbral de alerta: ${config.alert_threshold_percent}%
` + `D\xEDas para tendencia bajista: ${config.trend_decline_days}
` + `Comisi\xF3n por d\xF3lar: $${config.default_commission.toFixed(2)}
` + `Sueldo base: $${config.default_salary_usd.toLocaleString()} USD
` + `Intervalo de polling: ${config.poll_interval_minutes} min
` + `D\xEDa de pago: \xDAltimo d\xEDa del mes`, { parse_mode: "Markdown" });
  });
  bot.command("set_threshold", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value <= 0) {
      await ctx.reply("Uso: `/set_threshold 0.15` (porcentaje)", { parse_mode: "Markdown" });
      return;
    }
    config.alert_threshold_percent = value;
    setSetting("alert_threshold_percent", value.toString());
    await ctx.reply(`\u2705 Umbral actualizado a ${value}%`);
  });
  bot.command("set_commission", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value < 0) {
      await ctx.reply("Uso: `/set_commission 0.10` (pesos por d\xF3lar)", { parse_mode: "Markdown" });
      return;
    }
    config.default_commission = value;
    setSetting("default_commission", value.toString());
    await ctx.reply(`\u2705 Comisi\xF3n actualizada a $${value.toFixed(2)}/USD`);
  });
  bot.command("set_salary", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value <= 0) {
      await ctx.reply("Uso: `/set_salary 6000` (d\xF3lares)", { parse_mode: "Markdown" });
      return;
    }
    config.default_salary_usd = value;
    setSetting("default_salary_usd", value.toString());
    await ctx.reply(`\u2705 Sueldo actualizado a $${value.toLocaleString()} USD`);
  });
  bot.catch((err) => {
    console.error("[Bot] Error:", err);
  });
  return bot;
}
async function sendAlert(bot, chatId, message) {
  try {
    await bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[Bot] Failed to send alert:", error);
  }
}

// src/index.ts
console.log("\uD83E\uDD11 Dollar Check Bot starting...");
var config = loadConfig();
var db2 = initDatabase();
console.log("\u2705 Database initialized");
var savedThreshold = getSetting("alert_threshold_percent");
if (savedThreshold)
  config.alert_threshold_percent = parseFloat(savedThreshold);
var savedCommission = getSetting("default_commission");
if (savedCommission)
  config.default_commission = parseFloat(savedCommission);
var savedSalary = getSetting("default_salary_usd");
if (savedSalary)
  config.default_salary_usd = parseFloat(savedSalary);
var bot = createBot(config);
async function pollAndAlert() {
  try {
    console.log(`[Poll] Fetching rate at ${new Date().toISOString()}`);
    await fetchCurrentRate(config.oxr_app_id);
    const result = evaluateAlerts(config);
    if (result.shouldNotify) {
      console.log(`[Poll] Sending ${result.alerts.length} alert(s)`);
      await sendAlert(bot, config.telegram_chat_id, result.fullMessage);
    } else {
      console.log("[Poll] No alerts triggered");
    }
  } catch (error) {
    console.error("[Poll] Error:", error);
  }
}
var intervalMs = config.poll_interval_minutes * 60 * 1000;
setTimeout(pollAndAlert, 5000);
setInterval(pollAndAlert, intervalMs);
console.log(`\u2705 Polling every ${config.poll_interval_minutes} minutes`);
bot.start({
  onStart: () => {
    console.log("\u2705 Telegram bot is running");
    console.log(`\uD83D\uDCE1 Polling OXR every ${config.poll_interval_minutes}min`);
    console.log(`\u26A1 Alert threshold: ${config.alert_threshold_percent}%`);
    console.log(`\uD83D\uDCB0 Salary: $${config.default_salary_usd} USD`);
    console.log(`\uD83D\uDCB8 Commission: $${config.default_commission}/USD`);
  }
});
process.on("SIGINT", () => {
  console.log(`
\uD83D\uDED1 Shutting down...`);
  bot.stop();
  db2.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log(`
\uD83D\uDED1 Shutting down...`);
  bot.stop();
  db2.close();
  process.exit(0);
});
