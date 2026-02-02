# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operation Rules (MUST FOLLOW)

### Role
資深工程師，指導零程式經驗的使用者。

### Language
一律使用繁體中文（台灣）回覆。

### Code Edit Protocol (CRITICAL)
**禁止**使用局部 diff（如「在 X 行後加入這段」）。

**必須**使用「Before & After」格式：

**[Locate]** - 顯示原始程式碼區塊（供 Ctrl+F 搜尋）
```
// 原始程式碼，完整呈現
```

**[Replace]** - 顯示完整的新程式碼區塊（供直接複製貼上）
```
// 新程式碼，完整呈現
```

**範圍**：替換整個函式或邏輯區塊，不要只換單行。

### Tone
直接、簡潔、不廢話。

---

## Project Overview

益恆打卡平台 (YH Clock-In Platform) - An employee time tracking system built with React frontend and Google Apps Script backend using Google Sheets as the database.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (CDN-loaded)
- **Icons**: Lucide React
- **Backend**: Google Apps Script (`code.gs`)
- **Database**: Google Sheets
- **Notifications**: LINE Bot API

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000, all interfaces)
npm run build        # Production build
npm run preview      # Preview production build
```

## Architecture

### Frontend Structure

- `App.tsx` - Main router with view switching based on auth state
- `components/LoginView.tsx` - Authentication flows (login, password reset)
- `components/ClockInView.tsx` - Main clock-in/out interface with GPS verification
- `components/AdminDashboardView.tsx` - Admin panel with 8+ tabs (Staff, Location, Shift, Export, LINE, Log, Supervisor, Approval)
- `components/ChangePasswordView.tsx` - First-login password change requirement
- `services/api.ts` - Centralized API client with action-based routing

### Backend (code.gs)

Single Google Apps Script deployment with handler pattern:
- `handleXxx()` functions for each action
- 12+ Google Sheets for data storage (Staff, Records, Admin Logs, Supervisors, etc.)
- LINE Bot integration for notifications

### API Pattern

All API calls go to a single POST endpoint with action-based routing:
```typescript
api.post({ action: 'actionName', ...params })
```

Key action groups:
- **Auth**: login, autoLogin, changePassword, updatePassword, requestReset, verifyReset
- **User**: clockIn, getHistory, checkStatus, getLocations, getMonthlyStats
- **Admin**: adminGetData, adminUpdateLocation, adminUpdateStaff, adminUpdateShift, adminDownloadExcel
- **Requests**: submitMakeupRequest, submitLeaveRequest, getPendingRequests, approveRequest

### State Management

- React hooks (useState, useContext, useEffect)
- localStorage for caching: user data, locations, clock-in history, admin cache
- User-specific cache keys: `clockin_locations_{uid}`, `clockin_history_{uid}`

### Authentication Flow

1. Device ID generation and persistence in localStorage
2. Login with username + password + device ID
3. Auto-login via stored UID + device ID
4. Admin forced login with fingerprint unlock pattern

## Key Implementation Details

- **No-cache strategy**: API calls include `t=${Date.now()}` to prevent caching
- **GPS verification**: Haversine formula for distance calculation in `ClockInView.tsx`
- **20-hour lockout**: Button disabled after clock-in/out
- **PWA support**: manifest.json with app icons in `/public`
- **Language**: Traditional Chinese (zh-TW), hardcoded strings (no i18n)

## Data Models

- **Users**: name, uid, password, region, lineId, shift, allowRemote, admin/supervisor flags
- **Locations**: lat/lng coordinates, IP ranges, radius for validation
- **Records**: timestamp, location, GPS accuracy, IP address
- **Requests**: makeup (single day) and leave (date range) types with supervisor approval workflow
