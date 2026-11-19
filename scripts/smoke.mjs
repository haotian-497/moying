const base = process.env.BASE_URL ?? "http://localhost:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { cookie = "", method = "GET", body } = {}) {
  const response = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const nextCookie = setCookie[0]?.split(";")[0] || cookie;
  const text = await response.text();
  let json = null;
  if (text && (response.headers.get("content-type") || "").includes("json")) {
    json = JSON.parse(text);
  }
  return { status: response.status, location: response.headers.get("location"), text, json, cookie: nextCookie };
}

const stamp = Date.now().toString(36);
const userA = `墨引${stamp}`;
const userB = `读者${stamp}`;

const home = await request("/");
assert(home.status === 200, `home ${home.status}`);
assert(home.text.includes("一个题材，三个方向"), "home copy missing");

const locked = await request("/studio");
assert(locked.status === 307 || locked.status === 302, `studio without login ${locked.status}`);
assert(locked.location?.includes("/login"), `studio redirect ${locked.location}`);

const badLogin = await request("/api/auth/login", {
  method: "POST",
  body: { username: userA, password: "wrong-pass" },
});
assert(badLogin.status === 401, `bad login ${badLogin.status}`);

const registered = await request("/api/auth/register", {
  method: "POST",
  body: { username: userA, password: "secret-1" },
});
assert(registered.status === 201, `register A ${registered.status} ${registered.text}`);
assert(registered.cookie.includes("moyin_session"), "register cookie missing");

const duplicate = await request("/api/auth/register", {
  method: "POST",
  body: { username: userA, password: "secret-1" },
});
assert(duplicate.status === 409, `duplicate ${duplicate.status}`);

const other = await request("/api/auth/register", {
  method: "POST",
  body: { username: userB, password: "secret-2" },
});
assert(other.status === 201, `register B ${other.status} ${other.text}`);

const created = await request("/api/works", {
  method: "POST",
  cookie: registered.cookie,
  body: {
    theme: "周末一人食，不想再点外卖",
    platform: "xiaohongshu",
    audience: "一个人住的上班族",
    style: "真诚分享",
    notes: "不要鸡汤",
  },
});
assert(created.status === 201, `create ${created.status} ${created.text}`);
assert(created.json.work.directions?.length === 3, "expected 3 directions");
assert(!created.json.work.error, created.json.work.error || "unexpected error");
const workId = created.json.work.id;

const forbidden = await request(`/api/works/${workId}`, { cookie: other.cookie });
assert(forbidden.status === 404, `cross user read ${forbidden.status}`);

const written = await request(`/api/works/${workId}/content`, {
  method: "POST",
  cookie: registered.cookie,
  body: { index: 1 },
});
assert(written.status === 200, `content ${written.status} ${written.text}`);
assert(written.json.work.selectedIndex === 1, "selected index");
assert(written.json.work.content?.body?.length > 20, "body missing");
assert(written.json.work.content.titles.length >= 1, "titles missing");

const studio = await request("/studio", { cookie: registered.cookie });
assert(studio.status === 200, `studio ${studio.status}`);
assert(studio.text.includes(userA), "studio missing username");

const page = await request(`/works/${workId}`, { cookie: registered.cookie });
assert(page.status === 200, `work page ${page.status}`);
assert(page.text.includes("返回稿库"), "work page missing shell");

const removed = await request(`/api/works/${workId}`, { method: "DELETE", cookie: registered.cookie });
assert(removed.status === 200, `delete ${removed.status}`);
const gone = await request(`/api/works/${workId}`, { cookie: registered.cookie });
assert(gone.status === 404, `deleted read ${gone.status}`);

const loggedOut = await request("/api/auth/logout", { method: "POST", cookie: registered.cookie });
assert(loggedOut.status === 200, `logout ${loggedOut.status}`);
const after = await request("/api/works", { cookie: loggedOut.cookie });
assert(after.status === 401, `after logout ${after.status}`);

console.log("smoke ok", { userA, workId });
