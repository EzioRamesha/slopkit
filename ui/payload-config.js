/**
 * Host-side payload queue config (personal GitHub repo).
 * Saves ELFs + queue.json via GitHub Contents API using a session PAT.
 * @file ui/payload-config.js
 */
(function (global) {
  "use strict";

  var STORAGE_TOKEN = "ps5jb-gh-token";
  var STORAGE_OWNER = "ps5jb-gh-owner";
  var STORAGE_REPO = "ps5jb-gh-repo";
  var STORAGE_BRANCH = "ps5jb-gh-branch";
  var MAX_ELF = 0x400000;
  var QUEUE_PATH = "payloads/queue.json";

  /**
   * @returns {{owner:string,repo:string,branch:string}}
   */
  function repoConfig() {
    var owner = "";
    var repo = "";
    var branch = "main";
    try {
      owner = sessionStorage.getItem(STORAGE_OWNER) || "";
      repo = sessionStorage.getItem(STORAGE_REPO) || "";
      branch = sessionStorage.getItem(STORAGE_BRANCH) || "main";
    } catch (e) { /* ignore */ }
    if (!owner || !repo) {
      // Defaults for this personal host; override in the modal if forked.
      owner = owner || "EzioRamesha";
      repo = repo || "slopkit-personal";
    }
    return { owner: owner, repo: repo, branch: branch || "main" };
  }

  /**
   * @returns {string}
   */
  function getToken() {
    try {
      return sessionStorage.getItem(STORAGE_TOKEN) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * @param {string} token
   * @param {string} owner
   * @param {string} repo
   * @param {string} branch
   */
  function saveSession(token, owner, repo, branch) {
    try {
      if (token) sessionStorage.setItem(STORAGE_TOKEN, token);
      sessionStorage.setItem(STORAGE_OWNER, owner || "EzioRamesha");
      sessionStorage.setItem(STORAGE_REPO, repo || "slopkit-personal");
      sessionStorage.setItem(STORAGE_BRANCH, branch || "main");
    } catch (e) { /* ignore */ }
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  function validElfName(name) {
    return /^[A-Za-z0-9._-]+\.elf$/i.test(name);
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function bytesToBase64(bytes) {
    var CHUNK = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += CHUNK) {
      var slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      parts.push(String.fromCharCode.apply(null, slice));
    }
    return btoa(parts.join(""));
  }

  /**
   * @param {string} path
   * @returns {Promise<{sha:string|null, content:string|null, raw:Uint8Array|null}>}
   */
  async function ghGetFile(path) {
    var cfg = repoConfig();
    var token = getToken();
    if (!token) throw new Error("GitHub token required to edit host files");
    var url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner)
      + "/" + encodeURIComponent(cfg.repo)
      + "/contents/" + path.split("/").map(encodeURIComponent).join("/")
      + "?ref=" + encodeURIComponent(cfg.branch);
    var res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (res.status === 404) return { sha: null, content: null, raw: null };
    if (!res.ok) {
      var errText = await res.text();
      throw new Error("GitHub GET " + path + " failed: HTTP " + res.status
        + " " + errText.slice(0, 180));
    }
    var json = await res.json();
    var raw = null;
    var text = null;
    if (json.content && json.encoding === "base64") {
      var bin = atob(String(json.content).replace(/\n/g, ""));
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      raw = arr;
      try {
        text = new TextDecoder("utf-8").decode(arr);
      } catch (e) {
        text = null;
      }
    }
    return { sha: json.sha || null, content: text, raw: raw };
  }

  /**
   * @param {string} path
   * @param {string} message
   * @param {string} contentBase64
   * @param {string|null} sha
   */
  async function ghPutFile(path, message, contentBase64, sha) {
    var cfg = repoConfig();
    var token = getToken();
    if (!token) throw new Error("GitHub token required to edit host files");
    var url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner)
      + "/" + encodeURIComponent(cfg.repo)
      + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
    var body = {
      message: message,
      content: contentBase64,
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    var res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var errText = await res.text();
      throw new Error("GitHub PUT " + path + " failed: HTTP " + res.status
        + " " + errText.slice(0, 220));
    }
    return res.json();
  }

  /**
   * @param {string} path
   * @param {string} message
   * @param {string} sha
   */
  async function ghDeleteFile(path, message, sha) {
    var cfg = repoConfig();
    var token = getToken();
    if (!token) throw new Error("GitHub token required to edit host files");
    var url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner)
      + "/" + encodeURIComponent(cfg.repo)
      + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
    var res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        message: message,
        sha: sha,
        branch: cfg.branch
      })
    });
    if (!res.ok) {
      var errText = await res.text();
      throw new Error("GitHub DELETE " + path + " failed: HTTP " + res.status
        + " " + errText.slice(0, 220));
    }
  }

  /**
   * @returns {Promise<{version:number,autoInject:boolean,items:Array}>}
   */
  async function loadQueuePublic() {
    var res = await fetch("payloads/queue.json?ts=" + Date.now(), {
      cache: "no-store"
    });
    if (!res.ok) {
      return {
        version: 1,
        autoInject: true,
        items: [{ id: "pldmgr-default", name: "pldmgr.elf", delayAfterSec: 0 }]
      };
    }
    var q = await res.json();
    if (!q || !Array.isArray(q.items)) {
      q = { version: 1, autoInject: true, items: [] };
    }
    q.autoInject = !!q.autoInject;
    q.items = q.items.filter(function (it) {
      return it && validElfName(String(it.name || ""));
    }).map(function (it) {
      return {
        id: String(it.id || it.name),
        name: String(it.name),
        delayAfterSec: Math.max(0, Number(it.delayAfterSec) || 0)
      };
    });
    return q;
  }

  /**
   * @param {{version:number,autoInject:boolean,items:Array}} queue
   */
  async function saveQueueHost(queue) {
    var existing = await ghGetFile(QUEUE_PATH);
    var body = JSON.stringify({
      version: 1,
      autoInject: !!queue.autoInject,
      items: (queue.items || []).map(function (it) {
        return {
          id: String(it.id || it.name),
          name: String(it.name),
          delayAfterSec: Math.max(0, Number(it.delayAfterSec) || 0)
        };
      })
    }, null, 2) + "\n";
    var b64 = btoa(unescape(encodeURIComponent(body)));
    await ghPutFile(
      QUEUE_PATH,
      "chore(payloads): update inject queue",
      b64,
      existing.sha
    );
  }

  /**
   * @param {string} name
   * @param {Uint8Array} bytes
   */
  async function uploadElfHost(name, bytes) {
    if (!validElfName(name)) throw new Error("invalid ELF name");
    if (!bytes || !bytes.length) throw new Error("empty file");
    if (bytes.length > MAX_ELF) throw new Error("ELF larger than 4 MiB limit");
    if (bytes.length < 4 || bytes[0] !== 0x7f || bytes[1] !== 0x45
      || bytes[2] !== 0x4c || bytes[3] !== 0x46) {
      throw new Error("file is not an ELF");
    }
    var path = "payloads/" + name;
    var existing = await ghGetFile(path);
    await ghPutFile(
      path,
      "chore(payloads): upload " + name,
      bytesToBase64(bytes),
      existing.sha
    );
  }

  /**
   * @param {string} name
   */
  async function deleteElfHost(name) {
    if (!validElfName(name)) throw new Error("invalid ELF name");
    var path = "payloads/" + name;
    var existing = await ghGetFile(path);
    if (!existing.sha) return;
    await ghDeleteFile(path, "chore(payloads): delete " + name, existing.sha);
  }

  /**
   * @returns {string}
   */
  function newId() {
    return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  /**
   * Mount config modal UI.
   * @param {HTMLElement} root
   */
  function mount(root) {
    if (!root) return;

    root.innerHTML =
      '<div class="pc-backdrop" data-pc-close="1"></div>'
      + '<div class="pc-dialog" role="dialog" aria-modal="true" aria-label="Payload config">'
      + '<header class="pc-head"><h2>Payload queue</h2>'
      + '<button type="button" class="pc-x" data-pc-close="1" aria-label="Close">×</button></header>'
      + '<p class="pc-help">Host-side storage (GitHub). Token stays in this browser session only. '
      + "After Save, wait ~1 min for Pages to rebuild before running JB.</p>"
      + '<div class="pc-auth">'
      + '<label>Owner <input id="pcOwner" autocomplete="off" spellcheck="false"></label>'
      + '<label>Repo <input id="pcRepo" autocomplete="off" spellcheck="false"></label>'
      + '<label>Branch <input id="pcBranch" autocomplete="off" spellcheck="false"></label>'
      + '<label class="pc-token">GitHub PAT (repo scope) '
      + '<input id="pcToken" type="password" autocomplete="off" spellcheck="false"></label>'
      + '<button type="button" id="pcRemember">Remember for this tab</button>'
      + "</div>"
      + '<div class="pc-toolbar">'
      + '<label class="pc-toggle"><input type="checkbox" id="pcAuto"> Auto inject after jailbreak</label>'
      + '<label class="pc-file">Add ELF <input type="file" id="pcFile" accept=".elf,application/octet-stream"></label>'
      + "</div>"
      + '<ul class="pc-list" id="pcList"></ul>'
      + '<div class="pc-foot">'
      + '<button type="button" id="pcReload">Reload from host</button>'
      + '<button type="button" id="pcSave" class="pc-primary">Save to host</button>'
      + "</div>"
      + '<p class="pc-status" id="pcStatus" role="status"></p>'
      + "</div>";

    var queue = {
      version: 1,
      autoInject: true,
      items: []
    };

    var elList = root.querySelector("#pcList");
    var elAuto = root.querySelector("#pcAuto");
    var elStatus = root.querySelector("#pcStatus");
    var elOwner = root.querySelector("#pcOwner");
    var elRepo = root.querySelector("#pcRepo");
    var elBranch = root.querySelector("#pcBranch");
    var elToken = root.querySelector("#pcToken");

    function setStatus(msg, isErr) {
      elStatus.textContent = msg || "";
      elStatus.className = "pc-status" + (isErr ? " err" : "");
    }

    function fillAuthFields() {
      var cfg = repoConfig();
      elOwner.value = cfg.owner;
      elRepo.value = cfg.repo;
      elBranch.value = cfg.branch;
      elToken.value = getToken();
    }

    function renderList() {
      elAuto.checked = !!queue.autoInject;
      elList.innerHTML = "";
      if (!queue.items.length) {
        elList.innerHTML = '<li class="pc-empty">No payloads in queue. Add an ELF or save defaults.</li>';
        return;
      }
      queue.items.forEach(function (item, index) {
        var li = document.createElement("li");
        li.className = "pc-item";
        li.setAttribute("data-id", item.id);
        li.innerHTML =
          '<div class="pc-name"></div>'
          + '<label class="pc-delay">Delay after (sec) '
          + '<input type="number" min="0" step="1" inputmode="numeric"></label>'
          + '<div class="pc-actions">'
          + '<button type="button" data-act="up" title="Move up">↑</button>'
          + '<button type="button" data-act="down" title="Move down">↓</button>'
          + '<button type="button" data-act="del" title="Remove from queue">Delete</button>'
          + "</div>";
        li.querySelector(".pc-name").textContent = item.name;
        var delayInput = li.querySelector('input[type="number"]');
        delayInput.value = String(Math.max(0, Number(item.delayAfterSec) || 0));
        delayInput.addEventListener("change", function () {
          item.delayAfterSec = Math.max(0, parseInt(delayInput.value, 10) || 0);
        });
        li.querySelector('[data-act="up"]').addEventListener("click", function () {
          if (index <= 0) return;
          var tmp = queue.items[index - 1];
          queue.items[index - 1] = queue.items[index];
          queue.items[index] = tmp;
          renderList();
        });
        li.querySelector('[data-act="down"]').addEventListener("click", function () {
          if (index >= queue.items.length - 1) return;
          var tmp = queue.items[index + 1];
          queue.items[index + 1] = queue.items[index];
          queue.items[index] = tmp;
          renderList();
        });
        li.querySelector('[data-act="del"]').addEventListener("click", function () {
          var removeFile = false;
          try {
            removeFile = confirm(
              "Remove " + item.name + " from queue?\nOK = queue only\n"
              + "Use the next prompt to also delete the host file."
            );
          } catch (e) {
            removeFile = true;
          }
          if (!removeFile) return;
          var alsoDelete = false;
          try {
            alsoDelete = confirm("Also DELETE payloads/" + item.name + " from the host repo?");
          } catch (e2) {
            alsoDelete = false;
          }
          queue.items = queue.items.filter(function (x) { return x.id !== item.id; });
          renderList();
          if (alsoDelete) {
            setStatus("Deleting host file " + item.name + "…");
            deleteElfHost(item.name).then(function () {
              setStatus("Deleted host file " + item.name + ". Click Save to update queue.json.");
            }).catch(function (err) {
              setStatus(String(err && err.message ? err.message : err), true);
            });
          }
        });
        elList.appendChild(li);
      });
    }

    elAuto.addEventListener("change", function () {
      queue.autoInject = !!elAuto.checked;
    });

    root.querySelector("#pcRemember").addEventListener("click", function () {
      saveSession(elToken.value.trim(), elOwner.value.trim(), elRepo.value.trim(),
        elBranch.value.trim());
      setStatus("Saved credentials for this browser tab (session only).");
    });

    root.querySelector("#pcReload").addEventListener("click", function () {
      setStatus("Loading queue from host…");
      loadQueuePublic().then(function (q) {
        queue = q;
        renderList();
        setStatus("Loaded " + queue.items.length + " item(s) from host.");
      }).catch(function (err) {
        setStatus(String(err && err.message ? err.message : err), true);
      });
    });

    root.querySelector("#pcSave").addEventListener("click", function () {
      saveSession(elToken.value.trim(), elOwner.value.trim(), elRepo.value.trim(),
        elBranch.value.trim());
      setStatus("Saving queue.json to host…");
      saveQueueHost(queue).then(function () {
        setStatus("Saved on host. Wait ~1 minute for Pages rebuild, then run JB.");
      }).catch(function (err) {
        setStatus(String(err && err.message ? err.message : err), true);
      });
    });

    root.querySelector("#pcFile").addEventListener("change", function (ev) {
      var input = ev.target;
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      var name = file.name.split(/[/\\]/).pop();
      if (!validElfName(name)) {
        setStatus("Filename must be like name.elf (safe chars only).", true);
        return;
      }
      saveSession(elToken.value.trim(), elOwner.value.trim(), elRepo.value.trim(),
        elBranch.value.trim());
      setStatus("Uploading " + name + " to host…");
      file.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        return uploadElfHost(name, bytes).then(function () {
          var exists = queue.items.some(function (it) { return it.name === name; });
          if (!exists) {
            queue.items.push({
              id: newId(),
              name: name,
              delayAfterSec: 0
            });
          }
          renderList();
          setStatus("Uploaded " + name + ". Set order/delay, then Save queue.");
        });
      }).catch(function (err) {
        setStatus(String(err && err.message ? err.message : err), true);
      });
    });

    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute("data-pc-close")) {
        root.classList.remove("on");
      }
    });

    fillAuthFields();
    setStatus("Loading…");
    loadQueuePublic().then(function (q) {
      queue = q;
      renderList();
      setStatus("Ready. " + queue.items.length + " queued.");
    }).catch(function (err) {
      setStatus(String(err && err.message ? err.message : err), true);
    });
  }

  /**
   * @param {HTMLElement} root
   */
  function open(root) {
    if (!root) return;
    if (!root.getAttribute("data-mounted")) {
      mount(root);
      root.setAttribute("data-mounted", "1");
    }
    root.classList.add("on");
  }

  global.PayloadConfig = {
    open: open,
    loadQueuePublic: loadQueuePublic,
    validElfName: validElfName
  };
})(window);
