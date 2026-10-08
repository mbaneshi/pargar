---
title: شروع کار
description: پرگار را روی سیستم خودتان اجرا کنید، هستهٔ WASM را بسازید و آزمون‌ها را بگیرید.
---

ساده‌ترین راه آشنایی با پرگار، نسخهٔ مرجع در **[cad.houshkar.ir](https://cad.houshkar.ir)** است. چیزی نصب نمی‌شود و نقشه‌ها در مرورگر خودتان ذخیره می‌شوند.

اگر می‌خواهید دستی به کدش ببرید، آن را محلی اجرا کنید.

## پیش‌نیازها

| ابزار | نسخه |
|---|---|
| Rust | در `rust-toolchain.toml` ثابت شده |
| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | آخرین نسخه |
| Node.js | ۲۲ |
| pnpm | ۹ |

## ساخت و اجرا

```bash
git clone https://github.com/mbaneshi/pargar.git
cd pargar
pnpm install
pnpm build        # هستهٔ WASM و همهٔ بسته‌ها را می‌سازد
pnpm dev          # سرور توسعهٔ SvelteKit را بالا می‌آورد
```

`pnpm install` هوک‌های git مخزن را هم وصل می‌کند: پیش از هر commit قالب‌بندی و clippy، و پیش از هر push قواعد شاخه‌ها و یک دور CI محلی.

برای ساختن فقط هسته: `pnpm build:kernel`.

## آزمون‌ها

```bash
cd packages/kernel && cargo test    # آزمون‌های هستهٔ Rust
pnpm test                           # vitest در همهٔ بسته‌ها
pnpm exec playwright test           # آزمون سرتاسری، از جمله هم‌ترازی با AutoCAD
pnpm build                          # بررسی کامل ساخت
```

## نخستین نقشه

با `/` به خط فرمان بروید و این‌ها را امتحان کنید:

| کلید | فرمان | کلید | فرمان |
|---|---|---|---|
| `L` | خط | `M` | جابه‌جایی |
| `C` | دایره | `CO` | کپی |
| `A` | کمان | `RO` | چرخش |
| `PL` | چندخطی | `SC` | مقیاس |
| `REC` | مستطیل | `O` | Offset |
| `DT` | متن | `TR` | برش (Trim) |
| `DIM` | اندازه‌گذاری | `MI` | قرینه |
| `E` | پاک کردن | `F3` / `F8` | گیره / قائم |

با `Ctrl+Z` واگرد کنید و با `Ctrl+Shift+Z` ازنو؛ تا خودِ صفحهٔ خالی.

## ساختار مخزن

```text
packages/
  kernel/     هستهٔ هندسی Rust/WASM
  renderer/   رندر دوبعدی با Three.js
  file-io/    ورود و خروج DXF، ذخیره در OPFS
  core/       نوع‌های مشترک TypeScript
  mcp/        سرور MCP و tool-definitions.ts
  logger/     ثبت رویداد ساخت‌یافته
  app/        برنامهٔ SvelteKit
e2e/parity/   چارچوب آزمون هم‌ترازی با AutoCAD
notes/specs/  مشخصات فرمان‌های دوبعدی AutoCAD (YAML)
site/         همین وب‌سایت (Astro + Starlight)
```

نام بسته‌ها و crateها هنوز نام رمز `nexus` را دارند؛ یادگار دورهٔ پیش از انتشار پروژه.
