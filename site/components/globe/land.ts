/**
 * Land for the dotted globe. 12000 points spread evenly over a sphere (a Fibonacci lattice);
 * bit i of LAND says whether point i falls on land (3487 do). Computed once from Natural Earth's
 * 1:110m land outlines (public domain, via the world-atlas package) with d3-geo's geoContains.
 */

const COUNT = 12000;
const LAND =
  "AAAAAIAQABICRkJAAggpISkgpIQElIABMDcABkLAgRkZAAdi7sjMHJlpMfNkbu3Mpr30Nrf6Sttee7t/f+Xt//+Vv7/29v7/" +
  "2tv5fzt/f+Wt/P2dt/P2Vtbu21n5eytj9++tvJ21lfJ3VmbOzUm5Oys7Z+a0zJ2Rl3N3UnbOyOmZOSE/Z+bU7Jy42zNzcn7O" +
  "zcm5OSG35+b0/Jyam3Nzcm7Ozem5OT035+bk3Jyam3Nzak7Oze25OTU3p+b0nJya23Nzek5Ozem5OTUn5+bUnJyakXFzak5O" +
  "zKm5OTUn42bUnJyaUXMzek7OzKg5OTGjYmTknJ6aUXMyYk7NyYk5OTGnYuTEnJqRE3Nyak7NyMkZNSGnYsTEnJoRk3NyQk7F" +
  "iIkZNSUnYsTEnJqRUzNyQkbOiKkZMSGjZ+SUjJwRU3NiQk7PiCkZPSGiZsSEjJ4QUzJ6QkbNiCkZNSGmZtSUjJoQUzJqSk7N" +
  "iSk5NSGm5NSUnJoSU3JKSk5NKSk5JSWm5JSUnJJSU3IKSkzJKSk5JaWm5JSUjJpSUnIKSkzJKSk5BaWk5JSUiIpSUnIKSk1B" +
  "KSkxBaWk4JSUioJSUnBKSklBKSkYJaWkoJSUCpJSUmBqSkkBKSk0JKWkiJSUmgpSUmBISEkBqSkUBKSkwJSUGgJSU2BISEkB" +
  "KSkUBKSmwpCQmgJSUngISE0BISkUBKSmgBCQmgJCUkgISE0BISgVBISksBCQEgJCUUgISE0BISgFBISikBCQEgJCUUgICEVh" +
  "ISglBISisBCQggJCUUgICAEhISAFBISikBAQAgpCUEgoCAlhISAlFISikhAQEgpCQEkoCAEloSAkFYSCklAQEgpCQEsoCAFl" +
  "oSAlFISAklAQAgpCQEkoCAEFoSAkFQSAklAUAgpCQEkoCAAFoagEFQSAklRUAAoCQQEqCAAFoagAFASAglQQAAoCUQEqCAAF" +
  "oagAFASiAlQQAIpCUQEoCEQFoKAAFASiAlQQAApAUQEoCEQFoKAAFICiAlRUiApAQQEoCERFoKgAFICiAlRQiArAUREoIERF" +
  "oKgIFJCCIlRQCApAUREoIAQFoKgYFJCCIlRADApIQREoIAYFoIAYFJCCIlRADApIQREqIAQFoIAYFZCCIlBACApAQQEoIEUF" +
  "oIgQFJCCAlBADApAUSEoIAUFoIAQFICCAlBACApAASEoAAUFoIAQFICCAlBACgpAASEoCgVFoIAQFICCAlAECgpAASEoAgVF" +
  "oIgUFIAiAlAUCgpAESEoAAVFoCgUFIAiA1AUCopAUSkoAkVEoCgUFIEiAlAEiohAUQgoAkUEoCgUEYGiAlAEiohAUQggAkVE" +
  "oAgUEYGiAFQEiohAESgiAkVFqAgUEYGiAFQEiohQESgiAkVBqAgUEYEiUFQEioBQESgCAkVBqAgUAaEiUEQEioBQESgCAkXA" +
  "iAgUAaEiUAQEioAQESgCAkXgiAgUAaEiUAQEioARESgCAkWgCAgUASEiUAQEioARECgCQkWgCAgUASEiUAQEigARECgAQkSg" +
  "CAgUACMgUAAECAARECgAQgCgAAgQAAIhQAAEAAABECAABECAAAgAAAIhQAAEAAABECAABACAAAgAAAIhQAAIAACBEAAABAAA" +
  "AAAAAAIBAAAIAAABAAAABAAAABAAAAIgAAAIBAAAEAAABAAAABAIAAAgAAAIAAAAABAABAAAABAAAAAAIAAIAAAAIAAAAAAA" +
  "ABAAAABAAAAIAAAAIAAAAAAAADAAAABAAAAAAAAAIAAAAIAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAIAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIABAQAgI" +
  "KAEhJKQEhJSQklJSAkpKSekoLa2lp7X0npbW03NaWk9P6fk9P+fn9/y8n9/z+35/78/v+f2/v//3////";

/** Latitude and longitude, in radians, of every land point */
export function landPoints(): { lat: Float32Array; lon: Float32Array } {
  const bits = Uint8Array.from(atob(LAND), (c) => c.charCodeAt(0));
  const lat: number[] = [];
  const lon: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    lat.push(Math.asin(y));
    lon.push(Math.atan2(Math.sin(theta) * r, Math.cos(theta) * r));
  }
  return { lat: Float32Array.from(lat), lon: Float32Array.from(lon) };
}
