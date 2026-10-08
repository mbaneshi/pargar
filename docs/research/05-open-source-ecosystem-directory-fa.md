# فهرست اکوسیستم متن‌باز NEXUS

> فهرست جامع تمامی مخازن متن‌باز، اپلیکیشن‌ها، کتابخانه‌ها، ابزارها و منابع مرتبط با ابتکارات NEXUS: کد دوبعدی/سه‌بعدی (CAD)، مدل‌سازی اطلاعات ساختمان (BIM)، سیستم اطلاعات جغرافیایی (GIS)، مهندسی عمران، نقشه‌برداری، سنجش از دور، ابر نقاط، دوقلوی دیجیتال، ساخت‌وساز و زیرساخت پلتفرم (Rust/WASM، ECS، رندرینگ، همکاری بلادرنگ، عامل‌های هوش مصنوعی).
>
> آخرین به‌روزرسانی: ۱۴۰۵/۰۱/۲۳ (2026-04-12)

---

## فهرست مطالب

1. [کد تحت مرورگر (Browser-Based CAD)](#1-کد-تحت-مرورگر)
2. [کد دسکتاپ (مرجع)](#2-کد-دسکتاپ-مرجع)
3. [هسته‌های هندسی (WASM)](#3-هستههای-هندسی-wasm)
4. [حل‌کننده‌های قیود دوبعدی](#4-حلکنندههای-قیود-دوبعدی)
5. [پردازش BIM / IFC](#5-پردازش-bim--ifc)
6. [نمایشگرهای BIM (وب)](#6-نمایشگرهای-bim-وب)
7. [نویسندگی و پلتفرم‌های BIM](#7-نویسندگی-و-پلتفرمهای-bim)
8. [مدیریت ساخت‌وساز](#8-مدیریت-ساختوساز)
9. [GIS — کره سه‌بعدی و زمین](#9-gis--کره-سهبعدی-و-زمین)
10. [GIS — نقشه‌سازی دوبعدی / برداری](#10-gis--نقشهسازی-دوبعدی--برداری)
11. [GIS — تایل‌های برداری و فرمت‌های ابری](#11-gis--تایلهای-برداری-و-فرمتهای-ابری)
12. [GIS — تحلیل فضایی و ایندکس‌گذاری](#12-gis--تحلیل-فضایی-و-ایندکسگذاری)
13. [سیستم‌های مختصات و تصاویر نقشه‌ای](#13-سیستمهای-مختصات-و-تصاویر-نقشهای)
14. [سنجش از دور و تصاویر ماهواره‌ای](#14-سنجش-از-دور-و-تصاویر-ماهوارهای)
15. [ابر نقاط](#15-ابر-نقاط)
16. [فتوگرامتری و نقشه‌برداری با پهپاد](#16-فتوگرامتری-و-نقشهبرداری-با-پهپاد)
17. [مدل‌های سه‌بعدی شهری (CityGML / CityJSON)](#17-مدلهای-سهبعدی-شهری)
18. [دوقلوی دیجیتال و اینترنت اشیا](#18-دوقلوی-دیجیتال-و-اینترنت-اشیا)
19. [تجزیه‌کننده‌ها و نویسنده‌های فرمت فایل](#19-تجزیهکنندهها-و-نویسندههای-فرمت-فایل)
20. [رندرینگ سه‌بعدی (WebGL / WebGPU)](#20-رندرینگ-سهبعدی-webgl--webgpu)
21. [اکوسیستم Svelte و رابط کاربری](#21-اکوسیستم-svelte-و-رابط-کاربری)
22. [پاشش گاوسی و NeRF (وب)](#22-پاشش-گاوسی-و-nerf-وب)
23. [Rust فضایی / فیزیک / ریاضیات](#23-rust-فضایی--فیزیک--ریاضیات)
24. [کتابخانه‌ها و الگوهای ECS](#24-کتابخانهها-و-الگوهای-ecs)
25. [منبع‌یابی رویداد و CQRS](#25-منبعیابی-رویداد-و-cqrs)
26. [همکاری بلادرنگ (CRDT)](#26-همکاری-بلادرنگ-crdt)
27. [پایگاه‌داده‌های درون مرورگر](#27-پایگاهدادههای-درون-مرورگر)
28. [ذخیره‌سازی مرورگر (OPFS)](#28-ذخیرهسازی-مرورگر-opfs)
29. [هوش مصنوعی / LLM / ارکستراسیون عامل‌ها](#29-هوش-مصنوعی--llm--ارکستراسیون-عاملها)
30. [سرورهای MCP (هوش مصنوعی ↔ CAD/BIM/GIS)](#30-سرورهای-mcp)
31. [استنتاج هوش مصنوعی درون مرورگر](#31-استنتاج-هوش-مصنوعی-درون-مرورگر)
32. [رباتیک / ROS 2 / تله‌متری](#32-رباتیک--ros-2--تلهمتری)
33. [ابزارهای ساخت و مونوریپو](#33-ابزارهای-ساخت-و-مونوریپو)
34. [استانداردهای OGC و سرویس‌های وب](#34-استانداردهای-ogc-و-سرویسهای-وب)
35. [فهرست‌های گردآوری‌شده و منابع متا](#35-فهرستهای-گردآوریشده-و-منابع-متا)

---

## 1. کد تحت مرورگر

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **CADmium** | کد پارامتریک تحت مرورگر. Rust/WASM + SvelteKit + Three.js. از هسته B-Rep به نام Truck استفاده می‌کند. | Rust, TS | — | [GitHub](https://github.com/CADmium-Co/CADmium) · [بلاگ](https://mattferraro.dev/posts/cadmium) |
| **Chili3D** | کد سه‌بعدی تحت مرورگر. OpenCASCADE را به WASM کامپایل می‌کند. عملیات بولی، فیلت، مدل‌سازی پارامتریک، فرمت‌های صنعتی. | TS, C++ | — | [GitHub](https://github.com/xiangechen/chili3d) · [مقاله](https://www.blog.brightcoding.dev/2026/03/12/chili3d-the-revolutionary-browser-cad-tool-developers-crave) |
| **CADAM** | اپلیکیشن وب متن-به-کد مبتنی بر هوش مصنوعی. WASM بومی با کنترل‌های اسلایدر پارامتریک. | TS | — | [GitHub](https://github.com/Adam-CAD/CADAM) |
| **replicad** | کتابخانه کد TypeScript بر پایه opencascade.js. عملیات B-Rep، خروجی STEP، فیلت، لافت. | TS | MIT | [وبسایت](https://replicad.xyz/) · [GitHub](https://github.com/sgenoud/replicad) |
| **JSketcher** | مدل‌ساز پارامتریک دو و سه‌بعدی با جاوااسکریپت خالص. از OpenCASCADE برای عملیات جامد استفاده می‌کند. | JS | — | [GitHub](https://github.com/xibyte/jsketcher) |
| **CascadeStudio** | هسته کد اسکریپت‌نویسی زنده در مرورگر با opencascade.js. | JS | — | [GitHub](https://github.com/nicholasgasior/CascadeStudio) |
| **JSCAD** | مدل‌سازی پارامتریک سه‌بعدی مبتنی بر کد در مرورگر. موتور CSG جاوااسکریپت خالص. | JS | MIT | [وبسایت](https://openjscad.xyz/) · [GitHub](https://github.com/jscad/OpenJSCAD.org) |
| **Zoo Design Studio** | کد مرورگری از Zoo.dev. زبان KCL با رویکرد کد-محور. هوش مصنوعی متن-به-کد. | Rust, TS | MIT (اپ) | [وبسایت](https://zoo.dev/) · [GitHub](https://github.com/KittyCAD/modeling-app) |
| **Shapesmith** | مدل‌ساز جامد سه‌بعدی متن‌باز تحت مرورگر. | JS | — | [وبسایت](https://shapesmith.net/) |

---

## 2. کد دسکتاپ (مرجع)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **FreeCAD** | کد پارامتریک دسکتاپ کامل. نسخه ۱.۱ در مارس ۲۰۲۶ منتشر شد. از planegcs برای قیود دوبعدی استفاده می‌کند. | C++, Python | LGPL | [وبسایت](https://www.freecad.org/) · [GitHub](https://github.com/FreeCAD/FreeCAD) |
| **SolveSpace** | کد پارامتریک سبک دو و سه‌بعدی با حل‌کننده قیود. پورت آزمایشی WASM موجود است. | C++ | GPL-3.0 | [وبسایت](https://solvespace.com/) · [GitHub](https://github.com/solvespace/solvespace) |
| **Dune3D** | کد پارامتریک سه‌بعدی با حل‌کننده قیود. C++/GTK4/OpenCASCADE. | C++ | GPL-3.0 | [GitHub](https://github.com/dune3d/dune3d) |

---

## 3. هسته‌های هندسی (WASM)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **opencascade.js** | هسته کامل B-Rep از OpenCASCADE کامپایل‌شده به WASM. عملیات بولی، NURBS، فیلت، ورودی/خروجی STEP. | C++ → WASM | LGPL-2.1 | [GitHub](https://github.com/nicholasgasior/opencascade.js) |
| **Truck** | هسته کد Rust. B-rep با NURBS. توپولوژی رأس/یال/سیم/وجه/پوسته/جامد. بسته‌بندی JS. | Rust | Apache-2.0 | [GitHub](https://github.com/ricosjp/truck) |
| **Monstertruck** | B-Rep + NURBS بومی Rust از صفر. شامل T-splines. اتصالات WebAssembly/JS. | Rust | — | [GitHub](https://github.com/virtualritz/monstertruck) |
| **Fornjot** | هسته کد B-Rep در مراحل اولیه به زبان Rust. توسعه فعال. | Rust | — | [وبسایت](https://www.fornjot.app/) · [GitHub](https://github.com/hannobraun/fornjot) |
| **csgrs** | هسته CSG چندحالته در Rust. اعشار ۳۲/۶۴ بیتی. پشتیبانی WASM. | Rust | — | [GitHub](https://github.com/timschmidt/csgrs) |
| **Manifold** | عملیات بولی مش فوق‌سریع با تضمین منیفولد. حمایت Google. نسخه WASM. | C++ | Apache-2.0 | [GitHub](https://github.com/elalish/manifold) |
| **opencascade-rs** | اتصالات Rust به OpenCASCADE. قابلیت کامپایل به WASM. | Rust | — | [GitHub](https://github.com/nicholasgasior/opencascade-rs) |
| **occt-import-js** | رابط Emscripten برای وارد کردن OpenCASCADE. خواندن BREP، STEP، IGES در مرورگر. | C++ → WASM | — | [GitHub](https://github.com/nicholasgasior/occt-import-js) |

---

## 4. حل‌کننده‌های قیود دوبعدی

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **planegcs** | حل‌کننده قیود هندسی دوبعدی FreeCAD پورت‌شده به WASM. | C++ → WASM | LGPL | [GitHub](https://github.com/nicholasgasior/planegcs) |
| **SolveSpace (WASM)** | پورت آزمایشی WASM از حل‌کننده قیود SolveSpace. | C++ → WASM | GPL-3.0 | [GitHub](https://github.com/nicholasgasior/solvespace) |

---

## 5. پردازش BIM / IFC

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **web-ifc** | تجزیه‌کننده IFC به زبان C++ کامپایل‌شده به WASM. خواندن و نوشتن IFC با سرعت بومی. تبدیل به فرمت باینری «Fragments». | C++ → WASM | MPL-2.0 | [GitHub](https://github.com/ThatOpen/engine_web-ifc) |
| **IFC-lite** | نمایشگر IFC بومی مرورگر. تجزیه‌کننده Rust/WASM + رندرینگ WebGPU. اسکیمای IFC4X3 (۸۷۶ موجودیت). پردازش هندسه ۵ برابر سریع‌تر. | Rust, TS | — | [GitHub](https://github.com/louistrue/ifc-lite) · [Crate](https://crates.io/crates/ifc-lite-core) |
| **IfcOpenShell** | موتور هندسه IFC به زبان C++ با اتصالات Python. کامل‌ترین ابزار متن‌باز IFC. | C++, Python | LGPL | [وبسایت](https://ifcopenshell.org/) · [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) |
| **IFC++** | مدل کلاس C++ برای خواندن/نوشتن فایل‌های IFC STEP. نمایشگر Qt/OpenSceneGraph. | C++ | MIT | [وبسایت](https://ifcquery.com/) · [GitHub](https://github.com/ifcquery/ifcplusplus) |
| **That Open Engine Components** | مجموعه ابزار سطح بالای BIM. نمایشگر، بازرسی ویژگی‌ها، درخت‌های فضایی، اندازه‌گیری، BCF. | TS | — | [GitHub](https://github.com/ThatOpen/engine_components) |
| **Speckle** | پلتفرم تعامل‌پذیری داده AEC. گراف اشیای نسخه‌بندی‌شده. اتصال به Revit، Rhino، AutoCAD، Civil 3D، QGIS، Blender. | C#, TS | Apache-2.0 | [وبسایت](https://speckle.systems/) · [GitHub](https://github.com/specklesystems) |

---

## 6. نمایشگرهای BIM (وب)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **xeokit-sdk** | نمایشگر BIM با عملکرد بالا مبتنی بر WebGL. مختصات با دقت مضاعف. IFC، glTF، LAZ، CityJSON. | JS | AGPL-3.0 | [وبسایت](https://xeokit.github.io/xeokit-sdk/) · [GitHub](https://github.com/xeokit/xeokit-sdk) |
| **xeokit-bim-viewer** | پکیج نمایشگر مستقل BIM بر پایه xeokit SDK. پشتیبانی از IFC2x3 و IFC4. | JS | AGPL-3.0 | [GitHub](https://github.com/xeokit/xeokit-bim-viewer) |
| **BIMsurfer** | نمایشگر مدل IFC مبتنی بر WebGL برای BIMServer. نسخه ۳ با عملکرد بالای WebGL2. | JS | MIT | [GitHub](https://github.com/opensourceBIM/BIMsurfer) |
| **BIMROCKET** | پلتفرم وب‌محور BIM. مشاهده، ویرایش، مدیریت BCF/IFC. بک‌اند OrientDB/MongoDB. | Java, JS | — | [GitHub](https://github.com/bimrocket/bimrocket) |
| **Open IFC Viewer** | نمایشگر ساده IFC تحت مرورگر. | JS | — | [GitHub](https://github.com/nicholasgasior/Open-IFC-Viewer) |
| **bimvie.ws** | کلاینت جاوااسکریپت برای BIM با استفاده از استانداردهای IFC، BCF و BIMSie. | JS | — | [GitHub](https://github.com/opensourceBIM/bimvie.ws) |

---

## 7. نویسندگی و پلتفرم‌های BIM

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Bonsai (BlenderBIM)** | افزونه کامل نویسندگی BIM برای Blender. ایجاد/ویرایش/صدور IFC بومی. | Python | LGPL | [وبسایت](https://bonsaibim.org/) · [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) |
| **BIMserver** | همکاری BIM سمت سرور، نسخه‌بندی، ادغام، پرس‌وجوهای BimQL. | Java | AGPL-3.0 | [GitHub](https://github.com/opensourceBIM/BIMserver) |
| **OpenProject BIM** | مدیریت پروژه با نمایشگر یکپارچه IFC مبتنی بر xeokit. | Ruby | GPL-3.0 | [وبسایت](https://www.openproject.org/bim-project-management/) |

---

## 8. مدیریت ساخت‌وساز

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **OpenConstructionERP** | برآورد هزینه ساخت متن‌باز. صورت‌وضعیت (BOQ)، ۴D/5D، هوش مصنوعی، برداشت CAD/BIM. نمودار گانت با CPM. ردیابی EVM. ۲۱ زبان، بیش از ۵۵ هزار آیتم هزینه. | Python | — | [GitHub](https://github.com/datadrivenconstruction/OpenConstructionERP) |
| **OpenConstructionEstimate** | پایگاه‌داده چندزبانه هزینه ساخت برای عامل‌های هوش مصنوعی. بیش از ۵۵ هزار آیتم کار، ۲۷ هزار منبع. پایگاه برداری Qdrant. | Python | — | [GitHub](https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR) |
| **4D Schedule Viewer** | دمو BIM اتصال زمان‌بندی ساخت به مدل BIM. بصری‌سازی ۴ بعدی. | JS | — | [GitHub](https://github.com/ZeaInc/4d-schedule-viewer) |

---

## 9. GIS — کره سه‌بعدی و زمین

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **CesiumJS** | کره سه‌بعدی، استریم زمین، 3D Tiles، تصاویر ماهواره‌ای. شاخه WebGPU. | JS | Apache-2.0 | [وبسایت](https://cesium.com/platform/cesiumjs/) · [GitHub](https://github.com/CesiumGS/cesium) |
| **TerriaJS** | کاوشگر کامل داده‌های مکانی وب. بر پایه CesiumJS. تغذیه‌کننده دوقلوهای دیجیتال مقیاس ملی. | TS | Apache-2.0 | [وبسایت](https://terria.io/) · [GitHub](https://github.com/TerriaJS/terriajs) |
| **Maptalks** | کتابخانه نقشه دو و سه‌بعدی. افزونه Three.js برای بصری‌سازی سه‌بعدی. جایگزین متن‌باز Cesium. | JS | BSD-3 | [وبسایت](https://maptalks.org/) · [GitHub](https://github.com/maptalks/maptalks.js) |
| **Cesium Terrain Builder** | کتابخانه C++ برای تبدیل رسترهای DTM از GDAL به تایل‌های زمین Cesium. | C++ | MIT | [GitHub](https://github.com/geo-data/cesium-terrain-builder) |
| **TIN Terrain** | تولید مش‌های TIN از زمین رستری برای CesiumJS. | C++ | — | [GitHub](https://github.com/nicholasgasior/tin-terrain) |
| **TouchTerrain** | اپلیکیشن Python برای ایجاد مدل‌های زمین قابل چاپ سه‌بعدی از داده‌های ارتفاعی. وب‌اپ در touchterrain.org. | Python | GPL | [GitHub](https://github.com/nicholasgasior/TouchTerrain_for_CAGEO) |

---

## 10. GIS — نقشه‌سازی دوبعدی / برداری

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **MapLibre GL JS** | فورک متن‌باز Mapbox GL JS. تایل‌های برداری، نقشه‌های ۲D/2.5D. | JS | BSD-3 | [وبسایت](https://maplibre.org/) · [GitHub](https://github.com/maplibre/maplibre-gl-js) |
| **OpenLayers** | کتابخانه بنیادین نقشه‌سازی وب. تمام استانداردهای OGC، تایل‌های برداری، رندرینگ WebGL. | JS | BSD-2 | [وبسایت](https://openlayers.org/) · [GitHub](https://github.com/openlayers/openlayers) |
| **Leaflet** | نقشه‌های تعاملی سبک و سازگار با موبایل. اکوسیستم عظیم افزونه‌ها. | JS | BSD-2 | [وبسایت](https://leafletjs.com/) · [GitHub](https://github.com/Leaflet/Leaflet) |
| **Deck.gl** | بصری‌سازی داده با WebGL/WebGPU. ابرنقاط مقیاس بزرگ، لایه‌های مکانی. | JS | MIT | [وبسایت](https://deck.gl/) · [GitHub](https://github.com/visgl/deck.gl) |

---

## 11. GIS — تایل‌های برداری و فرمت‌های ابری

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **PMTiles (Protomaps)** | آرشیو تایل تک‌فایلی. خوانش بدون سرور با بازه بایت. نیازی به سرور تایل نیست. | JS, Go | BSD-3 | [وبسایت](https://protomaps.com/) · [GitHub](https://github.com/protomaps/PMTiles) |
| **Martin** | سرور تایل برداری متن‌باز. MVT از PostGIS، PMTiles، MBTiles. | Rust | Apache-2.0/MIT | [GitHub](https://github.com/maplibre/martin) |
| **Tippecanoe** | بهترین ابزار برای ساخت تایل‌های برداری از GeoJSON/FlatGeobuf/GeoParquet. نمای‌کلی هوشمند. | C++ | BSD-2 | [GitHub](https://github.com/felt/tippecanoe) |
| **FlatGeobuf** | فرمت باینری مکانی پرعملکرد. خوانش جریانی HTTP با بازه. | چندزبانه | BSD-2 | [وبسایت](https://flatgeobuf.org/) · [GitHub](https://github.com/flatgeobuf/flatgeobuf) |
| **GeoParquet** | Apache Parquet با فراداده مکانی. پرس‌وجوهای تحلیلی ابری. | مشخصات | Apache-2.0 | [وبسایت](https://geoparquet.org/) · [GitHub](https://github.com/opengeospatial/geoparquet) |
| **OpenMapTiles** | نقشه‌های جهانی خودمیزبان از تایل‌های برداری OpenStreetMap. | چندزبانه | BSD-3 | [وبسایت](https://openmaptiles.org/) · [GitHub](https://github.com/openmaptiles/openmaptiles) |

---

## 12. GIS — تحلیل فضایی و ایندکس‌گذاری

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Turf.js** | تحلیل مکانی پیشرفته در JS. اتصال فضایی، بافر، اندازه‌گیری. | JS | MIT | [وبسایت](https://turfjs.org/) · [GitHub](https://github.com/Turfjs/turf) |
| **H3-js** | شاخص فضایی شش‌ضلعی سلسله‌مراتبی Uber. | JS | Apache-2.0 | [GitHub](https://github.com/uber/h3-js) |
| **Flatbush** | درخت R ایستا فوق‌سریع برای نقاط/مستطیل‌های دوبعدی. | JS | ISC | [GitHub](https://github.com/mourner/flatbush) |
| **RBush** | شاخص فضایی دوبعدی پرعملکرد (درخت R). | JS | MIT | [GitHub](https://github.com/mourner/rbush) |
| **geokdbush** | افزونه جغرافیایی برای kdbush. پرس‌وجوهای نزدیک‌ترین همسایه روی عرض/طول جغرافیایی. | JS | ISC | [GitHub](https://github.com/mourner/geokdbush) |

---

## 13. سیستم‌های مختصات و تصاویر نقشه‌ای

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **PROJ** | تصاویر نقشه‌ای و تبدیلات مختصات. بیش از ۶۰۰۰ سیستم مرجع مختصات. | C | MIT | [وبسایت](https://proj.org/) · [GitHub](https://github.com/OSGeo/PROJ) |
| **proj4js** | پورت جاوااسکریپت PROJ. تبدیلات سبک CRS در مرورگر. | JS | MIT | [GitHub](https://github.com/proj4js/proj4js) |
| **GDAL** | کتابخانه مترجم جهانی مکانی. رستر + بردار. | C/C++ | MIT | [وبسایت](https://gdal.org/) · [GitHub](https://github.com/OSGeo/gdal) |
| **GDAL3.js** | GDAL + PROJ + GEOS + SpatiaLite کامپایل‌شده به WASM. تبدیل کامل مکانی در مرورگر. | C → WASM | — | [GitHub](https://github.com/nicholasgasior/gdal3.js) |
| **Loam** | پوشش جاوااسکریپت GDAL در مرورگر. بازتصویرسازی، تبدیل فرمت. | JS | MIT | [GitHub](https://github.com/azavea/loam) |

---

## 14. سنجش از دور و تصاویر ماهواره‌ای

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **STAC Spec** | کاتالوگ‌های دارایی زمانی-مکانی. استاندارد سازماندهی تصاویر ماهواره‌ای/هوایی. | مشخصات | Apache-2.0 | [وبسایت](https://stacspec.org/) · [GitHub](https://github.com/radiantearth/stac-spec) |
| **STAC Browser** | اپلیکیشن تک‌صفحه‌ای برای مرور کاتالوگ‌های ایستای STAC. | JS | Apache-2.0 | [وبسایت](https://radiantearth.github.io/stac-browser/) · [GitHub](https://github.com/radiantearth/stac-browser) |
| **geotiff.js** | تجزیه فایل‌های GeoTIFF/COG در مرورگر. جاوااسکریپت خالص. | JS | MIT | [GitHub](https://github.com/geotiffjs/geotiff.js) |
| **COG (Cloud Optimized GeoTIFF)** | مشخصات دسترسی کارآمد رستری مبتنی بر بازه HTTP. | مشخصات | — | [وبسایت](https://cogeo.org/) |
| **Titiler** | سرور تایل GeoTIFF بهینه‌شده برای ابر. FastAPI. | Python | MIT | [GitHub](https://github.com/developmentseed/titiler) |
| **Raster Foundry** | وب‌اپ تحلیل GIS روی Landsat، Sentinel، MODIS. پشتیبانی COG. | Scala, JS | Apache-2.0 | [GitHub](https://github.com/raster-foundry/raster-foundry) |
| **OL STAC** | افزونه OpenLayers برای منابع STAC. نمایش خودکار GeoTIFF، WMS و غیره. | JS | Apache-2.0 | [GitHub](https://github.com/m-mohr/ol-stac) |
| **Copernicus Data Space** | پلتفرم تصاویر ماهواره‌ای اروپا. داده رایگان Sentinel. دسترسی API. | — | — | [وبسایت](https://dataspace.copernicus.eu/) |

---

## 15. ابر نقاط

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Potree** | نمایشگر ابرنقاط WebGL. رندر میلیاردها نقطه از طریق LOD هشت‌درختی. | JS | BSD-2 | [وبسایت](https://potree.github.io/) · [GitHub](https://github.com/potree/potree) |
| **Potree-Next** | بازنویسی WebGPU از Potree. شیدرهای محاسباتی برای رمزگشایی GPU. مرحله تحقیقاتی. | JS | — | [GitHub](https://github.com/nicholasgasior/potree) |
| **COPC.js** | خواننده جاوااسکریپت ابرنقاط بهینه‌شده ابری. استریم LAZ از فضای ذخیره‌سازی ابری. | JS | MIT | [GitHub](https://github.com/connormanning/copc.js) |
| **laz-perf** | رفع‌فشرده‌سازی LAZ در JavaScript/WASM. رمزگشایی سریع ابرنقاط. | C++ → WASM | — | [GitHub](https://github.com/verma/laz-perf) |
| **LiDAR Viewer** | نمایشگر وب‌محور LiDAR. بارگذاری COPC LAZ با URL. استریم پویا، طرح‌های رنگی متعدد. | JS | — | [GitHub](https://github.com/opengeos/lidar-viewer) |
| **maplibre-gl-lidar** | افزونه MapLibre برای بصری‌سازی ابرنقاط LAS/LAZ/COPC. استریم پویای COPC. | JS | — | [GitHub](https://github.com/opengeos/maplibre-gl-lidar) |
| **PotreeConverter** | تبدیل LAS/LAZ به فرمت Potree برای استریم. | C++ | BSD-2 | [GitHub](https://github.com/potree/PotreeConverter) |
| **plas.io** | نمایشگر کشیدن و رها کردن LAS/LAZ در مرورگر. | JS | — | [وبسایت](https://plas.io/) |
| **LASViewer** | وب‌اپ مشاهده فایل‌های LiDAR LAS. تا ۲۵۰ میلیون نقطه. | JS | — | [GitHub](https://github.com/nicholasgasior/LASViewer) |
| **xeokit-convert** | ابزار خط فرمان برای تبدیل دسته‌ای IFC، CityJSON، LAZ، glTF به فرمت XKT از xeokit. | JS | AGPL-3.0 | [GitHub](https://github.com/xeokit/xeokit-convert) |
| **COPC Spec** | مشخصات ابرنقاط بهینه‌شده ابری. LAZ 1.4 با شاخص VLR. | مشخصات | — | [وبسایت](https://copc.io/) |

---

## 16. فتوگرامتری و نقشه‌برداری با پهپاد

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **OpenDroneMap (ODM)** | ابزار خط فرمان برای تبدیل تصاویر پهپاد به نقشه، ابرنقاط، مدل‌های سه‌بعدی، DEM. | C++, Python | AGPL-3.0 | [وبسایت](https://opendronemap.org/) · [GitHub](https://github.com/OpenDroneMap/ODM) |
| **WebODM** | رابط وب برای OpenDroneMap. پردازش کاربرپسند تصاویر پهپاد. | Python, JS | AGPL-3.0 | [وبسایت](https://opendronemap.org/webodm/) · [GitHub](https://github.com/OpenDroneMap/WebODM) |
| **Meshroom (AliceVision)** | خط لوله فتوگرامتری مبتنی بر گره. ابرنقاط متراکم و مش‌های بافت‌دار. | C++ | MPL-2.0 | [وبسایت](https://alicevision.org/) · [GitHub](https://github.com/alicevision/Meshroom) |
| **COLMAP** | خط لوله SfM و MVS سطح تحقیقاتی. پین‌هول + فیش‌آی. | C++ | BSD | [GitHub](https://github.com/colmap/colmap) |
| **OpenSplat** | پاشش گاوسی سه‌بعدی C++ رایگان از حالت‌های دوربین. قابل حمل، سبک، سریع. | C++ | MIT | [GitHub](https://github.com/pierotofy/OpenSplat) |

---

## 17. مدل‌های سه‌بعدی شهری (CityGML / CityJSON)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **3DCityDB** | پایگاه‌داده + ابزار برای CityGML/CityJSON. ورود/صدور. نمایشگر وب مبتنی بر CesiumJS. | Java, SQL | Apache-2.0 | [وبسایت](https://www.3dcitydb.org/) · [GitHub](https://github.com/3dcitydb/3dcitydb) |
| **3DCityDB-Web-Map** | نمایشگر مبتنی بر Cesium برای 3DCityDB. بصری‌سازی معنایی سه‌بعدی شهر در مقیاس بزرگ. | JS | Apache-2.0 | [GitHub](https://github.com/3dcitydb/3dcitydb-web-map) |
| **CityJSON** | رمزگذاری مبتنی بر JSON از CityGML. آسان و فشرده. نمایشگر وب شامل شده. | مشخصات | CC-BY-4.0 | [وبسایت](https://www.cityjson.org/) · [GitHub](https://github.com/cityjson) |
| **citygml4j** | API متن‌باز جاوا برای CityGML. خواندن/نوشتن CityGML و CityJSON. | Java | Apache-2.0 | [GitHub](https://github.com/citygml4j/citygml4j) |
| **azul** | نمایشگر مدل سه‌بعدی شهری برای مک. CityGML 1.0/2.0، CityJSON 1.0/1.1/2.0، IndoorGML، OBJ. | Swift | — | [GitHub](https://github.com/tudelft3d/azul) |
| **awesome-citygml** | فهرست گردآوری‌شده داده‌های باز CityGML از بیش از ۲۱ کشور. | — | — | [GitHub](https://github.com/OloOcki/awesome-citygml) |

---

## 18. دوقلوی دیجیتال و اینترنت اشیا

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **iTwin.js** (Bentley) | بصری‌سازی دوقلوی دیجیتال. BIM + GIS + داده‌های واقعیت. | TS | MIT | [وبسایت](https://www.itwinjs.org/) · [GitHub](https://github.com/iTwin/iTwinjs-core) |
| **Eclipse Ditto** | چارچوب دوقلوی دیجیتال IoT. رابط‌های REST/WS. مدیریت حالت «اشیا». SDK‌های Python/Java/JS/Go. | Java | EPL-2.0 | [وبسایت](https://eclipse.dev/ditto/) · [GitHub](https://github.com/eclipse-ditto/ditto) |
| **Eclipse BaSyx** | پوسته مدیریت دارایی (AAS) برای دوقلوهای دیجیتال صنعتی. MQTT، OPC-UA. | Java | EPL-2.0 | [GitHub](https://github.com/eclipse-basyx) |
| **DTCC Platform** | دوقلوهای دیجیتال برنامه‌ریزی شهری. Python. مرکز شهرهای دوقلوی دیجیتال (سوئد). | Python | MIT | [GitHub](https://github.com/dtcc-platform) |
| **OpenTwins** | پلتفرم دوقلوی دیجیتال ترکیبی متن‌باز. | چندزبانه | — | [GitHub](https://github.com/ertis-research/opentwins) |
| **Garnet Framework** | دوقلوهای دیجیتال زنده از طریق گراف‌های دانش پویا. | — | — | [GitHub](https://github.com/Open-Source-Digital-Twin) |
| **ODTP** | پلتفرم دوقلوی دیجیتال باز. اتوماسیون تولید و اشتراک‌گذاری دوقلوهای دیجیتال. | Python | — | [GitHub](https://github.com/odtp-org) |

---

## 19. تجزیه‌کننده‌ها و نویسنده‌های فرمت فایل

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **dxf-parser** | تجزیه‌کننده فایل DXF جاوااسکریپت. خواندن به اشیای ساختاریافته JS. | JS | MIT | [GitHub](https://github.com/gdsestimating/dxf-parser) |
| **dxf-viewer** | نمایشگر DXF دوبعدی جاوااسکریپت برای مرورگر. | JS | — | [GitHub](https://github.com/vagran/dxf-viewer) |
| **libredwg-web** | تجزیه‌کننده DWG/DXF با libredwg کامپایل‌شده به WASM. بومی مرورگر و Node.js. | C → WASM | — | [GitHub](https://github.com/mlightcad/libredwg-web) · [npm](https://www.npmjs.com/package/@mlightcad/libredwg-web) |
| **libdxfrw** | کتابخانه C++ برای خواندن/نوشتن DXF/DWG. خواندن DWG R14–2020. | C++ | — | [GitHub](https://github.com/codelibs/libdxfrw) |
| **rust_dxf** | کتابخانه Rust برای خواندن/نوشتن فایل‌های DXF. | Rust | — | [crates.io](https://crates.io/crates/dxf) |
| **shpjs** | تجزیه‌کننده Shapefile برای جاوااسکریپت. | JS | — | [GitHub](https://github.com/calvinmetcalf/shapefile-js) |
| **geotiff.js** | تجزیه فایل‌های GeoTIFF/COG در مرورگر. جاوااسکریپت خالص. | JS | MIT | [GitHub](https://github.com/geotiffjs/geotiff.js) |
| **loaders.gl** | چارچوب بارگذاری 3D Tiles، ابرنقاط، فرمت‌های مکانی. اکوسیستم vis.gl. | JS | MIT | [GitHub](https://github.com/visgl/loaders.gl) |

---

## 20. رندرینگ سه‌بعدی (WebGL / WebGPU)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Three.js** | کتابخانه استاندارد سه‌بعدی جاوااسکریپت. WebGL + WebGPU (آماده تولید از r171). بیش از ۱۰۰ هزار ستاره. | JS | MIT | [وبسایت](https://threejs.org/) · [GitHub](https://github.com/mrdoob/three.js) |
| **Babylon.js** | موتور کامل سه‌بعدی. WebGL + WebGPU. | TS | Apache-2.0 | [وبسایت](https://www.babylonjs.com/) · [GitHub](https://github.com/BabylonJS/Babylon.js) |
| **PlayCanvas** | موتور بازی WebGL/WebGPU. ران‌تایم متن‌باز. | JS | MIT | [وبسایت](https://playcanvas.com/) · [GitHub](https://github.com/playcanvas/engine) |
| **wgpu** | پیاده‌سازی WebGPU بین‌پلتفرمی، ایمن و خالص Rust. | Rust | MIT/Apache-2.0 | [وبسایت](https://wgpu.rs/) · [GitHub](https://github.com/gfx-rs/wgpu) |
| **Dawn** | پیاده‌سازی متن‌باز WebGPU از Google به زبان C++. | C++ | BSD-3 | [GitHub](https://dawn.googlesource.com/dawn) |
| **Zephyr3D** | موتور رندرینگ TypeScript WebGL + WebGPU. سبک و ماژولار. | TS | — | [GitHub](https://github.com/nicholasgasior/zephyr3d) |

---

## 21. اکوسیستم Svelte و رابط کاربری

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Svelte 5** | فریم‌ورک UI مبتنی بر کامپایلر. Runes برای واکنش‌گرایی ریزدانه. بدون DOM مجازی. | JS/TS | MIT | [وبسایت](https://svelte.dev/) · [GitHub](https://github.com/sveltejs/svelte) |
| **SvelteKit** | فریم‌ورک فول‌استک برای Svelte. مسیریابی، SSR، آداپتورها. | JS/TS | MIT | [GitHub](https://github.com/sveltejs/kit) |
| **Threlte** | Three.js اعلامی برای Svelte. گراف صحنه از طریق کامپوننت‌های Svelte. پشتیبانی WebGPU. | TS | MIT | [وبسایت](https://threlte.xyz/) · [GitHub](https://github.com/threlte/threlte) |
| **shadcn-svelte** | کامپوننت‌های زیبا و قابل سفارشی‌سازی برای Svelte. | TS | MIT | [وبسایت](https://shadcn-svelte.com/) · [GitHub](https://github.com/huntabyte/shadcn-svelte) |
| **Flowbite Svelte** | کتابخانه کامپوننت Tailwind CSS برای Svelte. | TS | MIT | [GitHub](https://github.com/themesberg/flowbite-svelte) |

---

## 22. پاشش گاوسی و NeRF (وب)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **3D Gaussian Splatting** | پیاده‌سازی مرجع اصلی. مبتنی بر CUDA. | Python, CUDA | — | [GitHub](https://github.com/graphdeco-inria/gaussian-splatting) |
| **GaussianSplats3D** | رندرر 3DGS مبتنی بر Three.js برای وب. فرمت‌های .ply، .splat، .ksplat. | JS | MIT | [GitHub](https://github.com/mkkellogg/GaussianSplats3D) |
| **splat (antimatter15)** | رندرر بلادرنگ 3DGS مبتنی بر WebGL. سبک. | JS | MIT | [GitHub](https://github.com/antimatter15/splat) |
| **gaussian-splatting-web** | نمایشگر پاشش گاوسی مبتنی بر WebGPU. EPFL/CVLAB. | JS | — | [GitHub](https://github.com/cvlab-epfl/gaussian-splatting-web) |
| **gsplat** | رستریزاسیون شتاب‌یافته CUDA. اتصالات Python. پروژه Nerfstudio. | Python, CUDA | Apache-2.0 | [GitHub](https://github.com/nerfstudio-project/gsplat) |
| **OpenSplat** | 3DGS سطح تولید. CPU/GPU، ویندوز/مک/لینوکس. | C++ | MIT | [GitHub](https://github.com/pierotofy/OpenSplat) |
| **awesome-3D-gaussian-splatting** | فهرست گردآوری‌شده مقالات و منابع 3DGS. | — | — | [GitHub](https://github.com/MrNeRF/awesome-3D-gaussian-splatting) |

---

## 23. Rust فضایی / فیزیک / ریاضیات

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Rapier** | موتور فیزیک دو و سه‌بعدی در Rust. اتصالات رسمی WASM. | Rust | Apache-2.0 | [وبسایت](https://rapier.rs/) · [GitHub](https://github.com/dimforge/rapier) |
| **Parry** | کتابخانه تشخیص برخورد دو و سه‌بعدی (از Rapier). اکنون به‌طور پیش‌فرض از glam استفاده می‌کند. | Rust | Apache-2.0 | [وبسایت](https://parry.rs/) · [GitHub](https://github.com/dimforge/parry) |
| **Barry** | فورک Parry با انواع Glam. بهینه‌شده برای اکوسیستم Bevy. | Rust | Apache-2.0 | [GitHub](https://github.com/Jondolf/barry) |
| **nalgebra** | کتابخانه جبر خطی برای Rust. ماتریس‌ها، بردارها، تبدیلات. | Rust | Apache-2.0 | [وبسایت](https://nalgebra.org/) · [GitHub](https://github.com/dimforge/nalgebra) |
| **glam** | کتابخانه ریاضی سریع و ساده برای بازی/گرافیک. f32 و f64. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/bitshifter/glam-rs) |
| **geo** | اولیه‌ها و الگوریتم‌های مکانی برای Rust. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/georust/geo) |
| **nphysics** | موتور فیزیک جسم صلب دو و سه‌بعدی برای Rust (پیشین Rapier). | Rust | Apache-2.0 | [GitHub](https://github.com/dimforge/nphysics) |

---

## 24. کتابخانه‌ها و الگوهای ECS

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Bevy** | موتور بازی داده‌محور در Rust. ECS در هسته. آماده WASM. رندرینگ WebGPU. بیش از ۱۸ هزار ستاره. | Rust | MIT/Apache-2.0 | [وبسایت](https://bevy.org/) · [GitHub](https://github.com/bevyengine/bevy) |
| **Bevy ECS (مستقل)** | ECS بیوی قابل استفاده به‌عنوان کتابخانه مستقل از موتور. | Rust | MIT/Apache-2.0 | [Crate](https://crates.io/crates/bevy_ecs) |
| **Flecs** | کتابخانه ECS فوق‌سریع به زبان C. پشتیبانی WASM. سیستم روابط، پرس‌وجوهای چندزبانه. | C | MIT | [وبسایت](https://www.flecs.dev/) · [GitHub](https://github.com/SanderMertens/flecs) |
| **bitECS** | ECS کوچک و سریع برای جاوااسکریپت. JS خالص، بدون وابستگی WASM. | JS | MPL-2.0 | [GitHub](https://github.com/NateTheGreatt/bitECS) |
| **Godot Engine** | موتور بازی کامل. MIT. خروجی WASM با SIMD. | C++ | MIT | [وبسایت](https://godotengine.org/) · [GitHub](https://github.com/godotengine/godot) |

---

## 25. منبع‌یابی رویداد و CQRS

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **cqrs-es** | چارچوب سبک CQRS و منبع‌یابی رویداد برای Rust. | Rust | Apache-2.0 | [مستندات](https://doc.rust-cqrs.org/) · [GitHub](https://github.com/serverlesstechnology/cqrs) |
| **event_sourcing.rs** | کتابخانه اصول‌گرای منبع‌یابی رویداد برای Rust. | Rust | — | [GitHub](https://github.com/primait/event_sourcing.rs) |
| **eventmill** | منبع‌یابی رویداد و CQRS برای اپلیکیشن‌های Rust. | Rust | — | [GitHub](https://github.com/innoave/eventmill) |
| **chronicle** | چارچوب CQRS منبع‌یابی رویداد برای Rust. | Rust | — | [GitHub](https://github.com/brendanzab/chronicle) |
| **Thalo** | ران‌تایم منبع‌یابی رویداد با پشتیبانی WebAssembly. | Rust | MIT | [GitHub](https://github.com/nicholasgasior/thalo) |
| **eventually-rs** | کتابخانه منبع‌یابی رویداد برای Rust. سری رویدادهای تغییرناپذیر، الگوی تجمیع. | Rust | MIT | [GitHub](https://github.com/nicholasgasior/eventually-rs) |

---

## 26. همکاری بلادرنگ (CRDT)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Yjs** | CRDT برای همکاری بلادرنگ. P2P از طریق WebRTC. بیش از ۹۰۰ هزار دانلود هفتگی npm. انواع اشتراکی، ویرایش آفلاین، عکس‌های فوری نسخه. | JS | MIT | [وبسایت](https://yjs.dev/) · [GitHub](https://github.com/yjs/yjs) |
| **Automerge** | CRDT از نوع JSON ساخته‌شده در Rust با اتصالات JS از طریق WASM. تاریخچه کامل سند. | Rust, JS | MIT | [وبسایت](https://automerge.org/) · [GitHub](https://github.com/automerge/automerge) |
| **Loro** | CRDT بر پایه گراف رویداد قابل بازپخش. متن غنی، لیست، نقشه، درخت قابل جابه‌جایی. Rust + JS (WASM) + Swift. | Rust | MIT | [وبسایت](https://loro.dev/) · [GitHub](https://github.com/loro-dev/loro) |

---

## 27. پایگاه‌داده‌های درون مرورگر

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **DuckDB-WASM** | پایگاه‌داده تحلیلی SQL در مرورگر. Parquet، CSV، JSON، Arrow، افزونه فضایی. سریع‌ترین موتور درون مرورگر. | C++ → WASM | MIT | [وبسایت](https://duckdb.org/) · [GitHub](https://github.com/duckdb/duckdb-wasm) |
| **SQLite WASM** | SQLite رسمی کامپایل‌شده به WASM. دامنه عمومی. پشتیبان OPFS برای ذخیره‌سازی پایدار. | C → WASM | دامنه عمومی | [وبسایت](https://sqlite.org/wasm/) |
| **sql.js** | SQLite کامپایل‌شده به JS از طریق Emscripten. اجرا در مرورگر. | C → WASM | MIT | [GitHub](https://github.com/sql-js/sql.js) |
| **PGlite** | PostgreSQL سبک در WASM. اجرا در مرورگر و Node.js. پشتیبانی فایل‌سیستم OPFS. | C → WASM | Apache-2.0 | [وبسایت](https://pglite.dev/) · [GitHub](https://github.com/electric-sql/pglite) |
| **RxDB** | پایگاه‌داده واکنش‌گرا و بلادرنگ برای جاوااسکریپت. آفلاین-اول. پشتیبانی OPFS + CRDT. | TS | Apache-2.0 | [وبسایت](https://rxdb.info/) · [GitHub](https://github.com/pubkey/rxdb) |

---

## 28. ذخیره‌سازی مرورگر (OPFS)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **OPFS (فایل‌سیستم خصوصی مبدأ)** | فایل‌سیستم جعبه‌شنی بومی مرورگر. ۳-۴ برابر سریع‌تر از IndexedDB. فتوشاپ تحت وب از آن استفاده می‌کند. | API وب | — | [مستندات MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) · [web.dev](https://web.dev/articles/origin-private-file-system) |
| **OPFS Explorer** | افزونه Chrome DevTools برای بررسی محتوای OPFS. | JS | — | [فروشگاه وب کروم](https://chromewebstore.google.com/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd) |

---

## 29. هوش مصنوعی / LLM / ارکستراسیون عامل‌ها

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **LangGraph.js** | ارکستراسیون عامل به‌عنوان گراف‌های جهت‌دار حالت‌دار. هماهنگی چندعاملی. | TS | MIT | [وبسایت](https://www.langchain.com/langgraph) · [GitHub](https://github.com/langchain-ai/langgraphjs) |
| **LangChain.js** | چارچوب اپلیکیشن LLM برای جاوااسکریپت. بیش از ۹۰ هزار ستاره. | TS | MIT | [GitHub](https://github.com/langchain-ai/langchainjs) |
| **Open Agent Platform** | رابط وب بدون کد برای ایجاد و مدیریت عامل‌های LangGraph. | TS | — | [GitHub](https://github.com/langchain-ai/open-agent-platform) |
| **CrewAI** | چارچوب چندعاملی مبتنی بر نقش. Python. | Python | MIT | [وبسایت](https://crewai.com/) · [GitHub](https://github.com/crewAIInc/crewAI) |
| **AutoGen** | چارچوب مکالمه چندعاملی توسط مایکروسافت. | Python | MIT | [GitHub](https://github.com/microsoft/autogen) |
| **MetaGPT** | چارچوب چندعاملی شبیه‌ساز شرکت نرم‌افزاری. | Python | MIT | [GitHub](https://github.com/geekan/MetaGPT) |
| **Vectra** | پایگاه‌داده برداری درون حافظه برای جاوااسکریپت. جستجوی برداری محلی. | TS | MIT | [GitHub](https://github.com/Stevenic/vectra) |

---

## 30. سرورهای MCP (هوش مصنوعی ↔ CAD/BIM/GIS)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **MCP Protocol Spec** | استاندارد پروتکل زمینه مدل. پذیرفته‌شده توسط Anthropic، OpenAI، Microsoft، Google. | مشخصات | MIT | [وبسایت](https://modelcontextprotocol.io/) · [GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol) |
| **MCP Servers (رسمی)** | پیاده‌سازی‌های مرجع سرور نگهداری‌شده توسط سازمان MCP. | چندزبانه | MIT | [GitHub](https://github.com/modelcontextprotocol/servers) |
| **GIS MCP Server** | سرور MCP برای عملیات GIS — تبدیل مختصات، تحلیل فضایی، عملیات هندسی. | Python | — | [GitHub](https://github.com/mahdin75/gis-mcp) |
| **CAD-MCP** | سرور MCP برای عملیات CAD. ترسیم خط، دایره، متن، حاشیه‌نویسی. | Python | — | [GitHub](https://github.com/daobataotie/CAD-MCP) |
| **openBIM-MCP** | سرور MCP برای BIM. تبدیل IFC به Fragments، بارگذاری Fragments، پرس‌وجوی داده BIM بر اساس دسته. | TS | — | [GitHub](https://github.com/helenkwok/openbim-mcp) |
| **ifcMCP** | سرور MCP برای کار عامل‌های LLM با فایل‌های IFC. استفاده از IfcOpenShell. | Python | — | [GitHub](https://github.com/nicholasgasior/ifcMCP) |
| **FreeCAD MCP** | مدل‌سازی CAD مبتنی بر هوش مصنوعی از طریق سرور RPC کنترل‌کننده FreeCAD. | Python | — | [GitHub](https://github.com/nicholasgasior/freecad-mcp) |
| **Revit MCP** | اتصال دستیار هوش مصنوعی به Autodesk Revit از طریق MCP + WebSocket. | C# | — | [وبسایت](https://archilabs.ai/posts/revit-model-context-protocol) |
| **AutoCAD LT MCP** | ترجمه زبان طبیعی به دستورات AutoLISP برای AutoCAD. | Python | — | [GitHub](https://github.com/nicholasgasior/autocad-lt-mcp) |
| **Microsoft MCP Catalog** | پیاده‌سازی‌های رسمی سرور MCP مایکروسافت. | چندزبانه | MIT | [GitHub](https://github.com/microsoft/mcp) |

---

## 31. استنتاج هوش مصنوعی درون مرورگر

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Transformers.js** | اجرای مدل‌های HuggingFace در مرورگر. Embeddings، NLP، بینایی. ONNX Runtime + WebGPU. | JS | Apache-2.0 | [وبسایت](https://huggingface.co/docs/transformers.js) · [GitHub](https://github.com/xenova/transformers.js) |
| **WebLLM** | استنتاج LLM پرعملکرد درون مرورگر از طریق WebGPU. Llama، Phi، Gemma، Mistral. | TS | Apache-2.0 | [وبسایت](https://webllm.mlc.ai/) · [GitHub](https://github.com/nicholasgasior/web-llm) |
| **ONNX Runtime Web** | اجرای مدل‌های ONNX در مرورگر با شتاب WebGPU. | TS | MIT | [وبسایت](https://onnxruntime.ai/) · [GitHub](https://github.com/microsoft/onnxruntime) |

---

## 32. رباتیک / ROS 2 / تله‌متری

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Robot Web Tools** | مجموعه کتابخانه‌ها برای اپلیکیشن‌های وب‌محور ربات با ROS. | JS | BSD | [وبسایت](https://robotwebtools.github.io/) · [GitHub](https://github.com/RobotWebTools) |
| **roslibjs** | کتابخانه جاوااسکریپت برای تعامل با ROS از مرورگر. | JS | BSD | [GitHub](https://github.com/RobotWebTools/roslibjs) |
| **ros2-web-bridge** | رابط JSON به ROS 2 از طریق پروتکل rosbridge v2 روی WebSocket. | JS | Apache-2.0 | [GitHub](https://github.com/nicholasgasior/ros2-web-bridge) |
| **opentera-webrtc-ros** | تله‌اپراسیون WebRTC برای ROS 2. کانال ویدیو + داده. | C++, Python | Apache-2.0 | [GitHub](https://github.com/nicholasgasior/opentera-webrtc-ros) |
| **Foxglove** | پلتفرم مشاهده‌پذیری رباتیک متن‌باز. وب + دسکتاپ. ROS، MCAP، Protobuf. | TS | MPL-2.0 | [وبسایت](https://foxglove.dev/) · [GitHub](https://github.com/foxglove/studio) |

---

## 33. ابزارهای ساخت و مونوریپو

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **Turborepo** | سیستم ساخت مونوریپو با عملکرد بالا. کش هوشمند. پیکربندی ترکیبی (نسخه ۲.۷+). | Go | MIT | [وبسایت](https://turborepo.dev/) · [GitHub](https://github.com/vercel/turborepo) |
| **pnpm** | مدیر بسته سریع و کم‌حجم. پشتیبانی Workspace برای مونوریپو. | JS | MIT | [وبسایت](https://pnpm.io/) · [GitHub](https://github.com/pnpm/pnpm) |
| **wasm-pack** | ساخت بسته‌های Rust → WASM برای npm. | Rust | MIT/Apache-2.0 | [وبسایت](https://rustwasm.github.io/wasm-pack/) · [GitHub](https://github.com/nicholasgasior/wasm-pack) |
| **wasm-bindgen** | تسهیل تعاملات سطح بالا بین Rust/WASM و جاوااسکریپت. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/nicholasgasior/wasm-bindgen) |
| **Vitest** | چارچوب تست بومی Vite. سریع، اولویت TypeScript. | TS | MIT | [وبسایت](https://vitest.dev/) · [GitHub](https://github.com/vitest-dev/vitest) |
| **Playwright** | تست E2E بین مرورگری. توسط مایکروسافت. | TS | Apache-2.0 | [وبسایت](https://playwright.dev/) · [GitHub](https://github.com/microsoft/playwright) |
| **esbuild** | باندلر فوق‌سریع JavaScript/TypeScript. مبتنی بر Go. | Go | MIT | [وبسایت](https://esbuild.github.io/) · [GitHub](https://github.com/evanw/esbuild) |
| **monorepo-typescript-rust** | قالب: pnpm workspaces + Next + Vite + Rust + Turborepo. | Rust, TS | — | [GitHub](https://github.com/spa5k/monorepo-typescript-rust) |

---

## 34. استانداردهای OGC و سرویس‌های وب

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **OGC API Spec** | استانداردهای مدرن API مکانی مبتنی بر REST (Features، Tiles، Maps، Processes). | مشخصات | — | [وبسایت](https://ogcapi.ogc.org/) · [GitHub](https://github.com/opengeospatial/ogcapi-features) |
| **GeoServer** | سرور متن‌باز اشتراک‌گذاری داده‌های مکانی. WMS، WFS، WCS، OGC API. | Java | GPL-2.0 | [وبسایت](https://geoserver.org/) · [GitHub](https://github.com/geoserver/geoserver) |
| **MapServer** | سرور وب مکانی مبتنی بر CGI. WMS، WFS، OGC API Features. | C | MIT | [وبسایت](https://mapserver.org/) · [GitHub](https://github.com/MapServer/MapServer) |
| **GeoNode** | CMS مکانی وب. آپلود، اشتراک‌گذاری، مدیریت داده‌های فضایی. بر پایه GeoServer + Django. | Python | GPL-3.0 | [وبسایت](https://geonode.org/) · [GitHub](https://github.com/GeoNode/geonode) |
| **MapStore** | چارچوب مدرن نقشه‌سازی وب. نمایشگر دو و سه‌بعدی، داشبوردها. React + OpenLayers + CesiumJS. | JS | BSD-2 | [وبسایت](https://mapstore.geosolutionsgroup.com/) · [GitHub](https://github.com/geosolutions-it/MapStore2) |
| **pygeoapi** | سرور Python پیاده‌سازی‌کننده استانداردهای OGC API. سبک و آسان برای استقرار. | Python | MIT | [وبسایت](https://pygeoapi.io/) · [GitHub](https://github.com/geopython/pygeoapi) |

---

## 35. فهرست‌های گردآوری‌شده و منابع متا

| پروژه | توضیحات | لینک‌ها |
|--------|---------|---------|
| **awesome-civil-engineering** | فهرست گردآوری‌شده نرم‌افزار و منابع مهندسی عمران. | [GitHub](https://github.com/QuantumNovice/awesome-civil-engineering) |
| **awesome-frontend-gis** | منابع مکانی گردآوری‌شده برای توسعه وب. | [GitHub](https://github.com/nicholasgasior/awesome-frontend-gis) |
| **awesome-geospatial** | فهرست جامع ابزارها و منابع مکانی. | [GitHub](https://github.com/sacridini/Awesome-Geospatial) |
| **awesome-3D-gaussian-splatting** | فهرست گردآوری‌شده مقالات و منابع 3DGS. | [GitHub](https://github.com/MrNeRF/awesome-3D-gaussian-splatting) |
| **awesome-citygml** | داده‌های باز CityGML از بیش از ۲۱ کشور. | [GitHub](https://github.com/OloOcki/awesome-citygml) |
| **awesome-duckdb** | فهرست گردآوری‌شده منابع DuckDB. | [GitHub](https://github.com/davidgasquez/awesome-duckdb) |
| **Cloud-Native Geospatial Forum** | جامعه استانداردهای COG، STAC، GeoParquet، COPC. | [وبسایت](https://cloudnativegeo.org/) |
| **CRDT.tech** | فهرست جامع پیاده‌سازی‌های CRDT در زبان‌های مختلف. | [وبسایت](https://crdt.tech/implementations) |
| **STAC Index** | فهرست کاتالوگ‌ها، APIها و ابزارهای اکوسیستم STAC. | [وبسایت](https://stacindex.org/) |
| **WebGL/WebGPU Frameworks List** | مجموعه چارچوب‌ها و کتابخانه‌های WebGL و WebGPU. | [GitHub Gist](https://gist.github.com/dmnsgn/76878ba6903cf15789b712464875cfdc) |

---

## مهندسی عمران و نقشه‌برداری (تخصصی)

| پروژه | توضیحات | زبان | مجوز | لینک‌ها |
|--------|---------|------|------|---------|
| **GeoEasy** | محاسبات نقشه‌برداری زمینی، تنظیم شبکه، مدل‌های رقومی زمین، رگرسیون. | Tcl | GPL | [GitHub](https://github.com/zsiki/GeoEasy) |
| **Surveying Calculator** | اپلیکیشن مهندسی با قابلیت‌های نقشه‌برداری و GIS. استفاده از QGIS، GDAL، PROJ. | Python | — | [GitHub](https://github.com/edips/surveyingcalculator) |
| **Survey2GIS** | تبدیل داده‌های نقشه‌برداری میدانی (GPS/توتال استیشن) به هندسه (SHP، GeoJSON، KML). | C | GPL | [وبسایت](https://www.nfdi4objects.net/en/portal/services/survey2gis/) |
| **CalcForge** | ماشین‌حساب‌های مهندسی متن‌باز. عمران، مکانیک، برق. | Python | — | [وبسایت](https://calcforge.com/) · [GitHub](https://github.com/calcforge) |
| **EngineeringPaper.xyz** | ابزار محاسبات مهندسی رایگان تحت مرورگر. | JS | MIT | [وبسایت](https://engineeringpaper.xyz/) |
| **Open Civil 3D Data** | مجموعه داده‌های باز برای گردش‌کارهای مهندسی عمران. | — | — | (منابع متعدد) |

---

## آمار خلاصه

| دسته‌بندی | تعداد |
|-----------|-------|
| کد تحت مرورگر | ۹ |
| کد دسکتاپ (مرجع) | ۳ |
| هسته‌های هندسی (WASM) | ۸ |
| حل‌کننده‌های قیود دوبعدی | ۲ |
| پردازش BIM / IFC | ۶ |
| نمایشگرهای BIM (وب) | ۶ |
| نویسندگی و پلتفرم‌های BIM | ۳ |
| مدیریت ساخت‌وساز | ۳ |
| GIS — کره سه‌بعدی و زمین | ۶ |
| GIS — نقشه‌سازی دوبعدی / برداری | ۴ |
| GIS — تایل‌های برداری و ابری | ۶ |
| GIS — تحلیل فضایی و ایندکس‌گذاری | ۵ |
| سیستم‌های مختصات و تصاویر نقشه‌ای | ۵ |
| سنجش از دور و تصاویر ماهواره‌ای | ۸ |
| ابر نقاط | ۱۱ |
| فتوگرامتری و نقشه‌برداری با پهپاد | ۵ |
| مدل‌های سه‌بعدی شهری | ۶ |
| دوقلوی دیجیتال و اینترنت اشیا | ۷ |
| تجزیه‌کننده‌های فرمت فایل | ۸ |
| رندرینگ سه‌بعدی (WebGL/WebGPU) | ۶ |
| اکوسیستم Svelte و UI | ۵ |
| پاشش گاوسی و NeRF | ۷ |
| Rust فضایی / فیزیک / ریاضیات | ۷ |
| کتابخانه‌ها و الگوهای ECS | ۵ |
| منبع‌یابی رویداد و CQRS | ۶ |
| همکاری بلادرنگ (CRDT) | ۳ |
| پایگاه‌داده‌های درون مرورگر | ۵ |
| ذخیره‌سازی مرورگر (OPFS) | ۲ |
| هوش مصنوعی / LLM / ارکستراسیون عامل‌ها | ۷ |
| سرورهای MCP | ۱۰ |
| استنتاج هوش مصنوعی درون مرورگر | ۳ |
| رباتیک / ROS 2 / تله‌متری | ۵ |
| ابزارهای ساخت و مونوریپو | ۸ |
| استانداردهای OGC و سرویس‌های وب | ۶ |
| فهرست‌های گردآوری‌شده و منابع متا | ۱۰ |
| مهندسی عمران و نقشه‌برداری | ۶ |
| **مجموع** | **بیش از ۲۱۰** |
