# ⚡ rbxts-transformer-optimizer

<div align="center">

[![ISC License](https://img.shields.io/badge/license-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![npm version](https://img.shields.io/npm/v/rbxts-transformer-optimizer)](https://www.npmjs.com/package/rbxts-transformer-optimizer)

<div align="left">

A high-performance TypeScript transformer that optimizes array and map operations for Roblox-TS

## 📦 Installation

```bash
npm install rbxts-transformer-optimizer --save-dev
```

## 🛠 Configuration

Add to your ``tsconfig.json``:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "rbxts-transformer-optimizer",
      }
    ]
  }
}
```

## 💡 Usage
The transformer will automatically optimize patterns like:

```ts
const array = [1, 2, 3];
const doubled = array.map(x => x * 2);
const filtered = array.filter(x => x > 10);
```

will look like:

```lua
local array = { 1, 2, 3 }
local __result_0 = table.create(#array)
for __index, x in pairs(array) do
	do
		__result_0[__index + 1] = x * 2
		continue
	end
end
local doubled = __result_0
local __result_1 = {}
for __index, x in pairs(array) do
	if x > 10 then
		table.insert(__result_1, x)
		continue
	end
end
local filtered = __result_1
```

Transformer will try to turn the function into a loop if possible. The following methods are currently supported

| Method          | Optimization Details                                                                 | Example |
|-----------------|-------------------------------------------------------------------------------------|---------|
| `array.map()`   | Converts to `for` loop with pre-allocated array                                     | `[1,2,3].map(x => x*2)` → `for` loop |
| `array.filter()`| Transforms to `for` loop with conditional push                                      | `[1,2,3].filter(x => x>1)` → `for` loop |
| `array.find()`  | Optimizes to early-returning loop                                                   | `[1,2,3].find(x => x===2)` → `for` loop with break |
| `array.findIndex()` | Converts to loop with index return                                             | `[1,2,3].findIndex(x => x===2)` → indexed loop |
| `array.forEach()`| Transforms to simple iteration loop                                               | `[1,2,3].forEach(print)` → basic `for` loop |
| `map.forEach()`| Transforms to simple iteration loop                                               | `new Map([["a", "b"], ["c", "d"]]).forEach((v, i) => print(v, i));` → basic `for` loop |

<p align="center">
Charm is released under the <a href="LICENSE.md">MIT License</a>.
</p>

<div align="center">

[![MIT License](https://img.shields.io/github/license/Tesmi-Develop/rbxts-transformer-optimizer?style=for-the-badge)](LICENSE.md)
