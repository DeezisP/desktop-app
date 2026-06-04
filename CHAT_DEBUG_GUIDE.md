# Chat Data Structure Debugging Guide (v2.0.22)

## Opening Developer Console

**Windows/Linux**: Press `F12` or `Ctrl+Shift+I`
**Mac**: Press `Cmd+Option+I`

Navigate to **Console** tab.

---

## Log Points to Inspect

### 1. API Response Structure
Look for:
```
[useChat] ═══════════════════════════════════════════════════
[useChat] getRooms() API response:
[useChat] first room from API: {...}
```

**What to verify:**
- ✅ `id` exists and is a number
- ✅ `name` exists and is a non-empty string
- ✅ `lastMessage` is a string or null
- ✅ `lastMessageAt` is an ISO datetime string
- ✅ `members` array exists (should not be empty)
- ✅ First member has `id`, `role`, `username`, `email`, `firstname`, `lastname`

**Red flags:**
- ❌ `name` is undefined or empty string
- ❌ `members` is undefined (should be array)
- ❌ `id` is missing
- ❌ `members` array is empty for non-guest conversations

### 2. Store Transformation
Look for:
```
[selectSortedRooms] raw rooms count: N
[selectSortedRooms] sorted rooms count: N
```

**What to verify:**
- ✅ Count matches API response
- ✅ Rooms are sorted by `lastMessageAt DESC` (newest first)
- ✅ First sorted room has all expected fields

**Red flags:**
- ❌ Sorted count is less than raw count (something was filtered)
- ❌ Rooms not sorted by date (order is random)

### 3. Filter Operations
Look for:
```
[ChatRoomList] after filter - valid rooms: N filtered out: M
```

**What to verify:**
- ✅ Number of filtered-out rooms is reasonable
- ✅ Only rooms with null/empty `lastMessage` are filtered
- ✅ Guest conversations (with `guestToken`) are NOT filtered

**Red flags:**
- ❌ Many valid conversations being filtered out
- ❌ All conversations filtered (shows as 0 valid rooms)
- ❌ Filtering logic removing conversations that should display

### 4. Per-Room Logging
Look for:
```
[ChatRoomList] room[0]: {id: 123, name: "...", membersCount: N, ...}
[RoomItem] rendering room 123: name="..." isGuest=true
```

**What to verify for each room:**
- ✅ `id` is number
- ✅ `name` is string (not empty)
- ✅ `membersCount` is number or 'undefined' (not expected if API returns members)
- ✅ `guestToken` shows `✓` for guest conversations

**Red flags:**
- ❌ `name` is empty or very long
- ❌ `nameLength` is 0
- ❌ `guestToken` is `(none)` for what should be guest conversation

### 5. Render Output
Look for:
```
[RoomItem] rendering room 123: name="Guest Support: abc123" isGuest=true
```

**What you should see:**
- ✅ For guest: `isGuest=true` with `guestToken` in name
- ✅ For customer: `isGuest=false` with customer name
- ✅ All room IDs are shown
- ✅ No "undefined" in names

**Red flags:**
- ❌ No [RoomItem] logs at all (component not rendering)
- ❌ Names showing as "Room #123" (means name was null/empty)
- ❌ Missing rooms from list that appeared in API response

---

## Common Issues and Solutions

### Issue: No Rooms Display in Chat
**Check:**
1. Look for `[ChatRoomList] showing empty state`
2. Check `[ChatRoomList] after filter - valid rooms: 0`
3. Look at `[ChatRoomList] room[0]:` logs - count them

**Diagnosis:**
- If `raw rooms count: N` but `valid rooms: 0` → Filter is too strict
- If `raw rooms count: 0` → API not returning rooms
- If no [RoomItem] logs → Component not rendering at all

**Solution:**
- Check API response for `lastMessage` field
- If rooms have `lastMessage: null`, API is returning incomplete data
- Adjust filter if needed

### Issue: Room Names Are Blank
**Check:**
1. Look for `nameLength: 0` in room logs
2. Check if name shows as "Room #123" in the UI
3. Look for store warnings: `[chatStore] Room X has empty name`

**Diagnosis:**
- API returning rooms with `name: null` or `name: ""`
- UI fallback is working (shows "Room #123")

**Solution:**
- Check backend API response
- Verify ChatRoom entity is setting name properly
- May need to derive name from members or guestToken

### Issue: Guest Conversations Not Showing
**Check:**
1. Filter for logs with `isGuest=true`
2. Look for `guestToken: ✓` in room logs
3. Check if rooms are being filtered out

**Diagnosis:**
- Guest conversations have `lastMessage: null`
- Filter is removing them
- OR guestToken is not set in API response

**Solution:**
- Guest conversations SHOULD have a `lastMessage` (e.g., "Joined")
- If not, either:
  a) API needs to set lastMessage for new conversations
  b) Filter logic needs adjustment
  c) Rooms should not be filtered if guestToken exists

---

## Debug Checklist

When troubleshooting, work through this checklist:

- [ ] Open DevTools Console (F12)
- [ ] Navigate to Chat tab
- [ ] Observe console logs without errors
- [ ] Find API response logs: `[useChat] ═══`
- [ ] Verify room count matches expectation
- [ ] Check first room structure completely
- [ ] Verify members field exists and populated
- [ ] Look for room names in logs
- [ ] Check filter operations
- [ ] Verify sort order (latest first)
- [ ] Count [RoomItem] renders
- [ ] Verify all names are valid (no "undefined")
- [ ] Compare UI display with console logs
- [ ] Identify any warnings or errors

---

## Performance Monitoring

The logging also helps monitor performance:

**Good signs:**
- Logs complete within <100ms
- All rooms loaded at once
- No repeated subscriptions
- Sorting happens once per update

**Bad signs:**
- Logs taking >1 second
- Many duplicate logs (infinite loop)
- Rooms loading one-by-one
- Multiple sort operations

---

## Disabling Logs (Production)

When shipping to production, logs can be removed by:

1. Setting `DEBUG=false` in environment
2. Using conditional logging:
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log(...)
   }
   ```
3. Using a logging library with levels

For now, logs are enabled to help identify issues.

---

## Related Files

- `/src/hooks/useChat.ts` - API loading and logging
- `/src/store/chatStore.ts` - Store transformation
- `/src/components/chat/ChatRoomList.tsx` - Filter and render
- `/src/types/chat.ts` - Type definitions
- `/src/api/chatApi.ts` - API client

---

## Questions?

Check the console logs following this order:
1. useChat API logs (raw data)
2. selectSortedRooms (store transformation)
3. ChatRoomList filter (which rooms remain)
4. RoomItem render (what's actually displayed)
