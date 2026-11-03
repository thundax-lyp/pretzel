(() => {
    const data = structuredClone(window.LEVEL_PACK);
    const params = new URLSearchParams(location.search);
    if (params.has("export")) document.body.classList.add("export");
    const layerChoice = Number(params.get("layers") || data.grid.maxLayers);
    if ([4, 6, 7, 8].includes(layerChoice) && window.STRUCTURE_STUDY) {
        data.grid.maxLayers = layerChoice;
        data.packs = data.packs.map((pack) => {
            const sample = window.STRUCTURE_STUDY.find(
                (v) => v.theme === pack.slug && v.variant === layerChoice,
            );
            return { ...pack, hard: sample.level };
        });
    }
    const updatePhoneScale = () =>
        document.documentElement.style.setProperty(
            "--phone-scale",
            Math.min(0.9230769, (innerWidth - 20) / 390),
        );
    updatePhoneScale();
    window.addEventListener("resize", updatePhoneScale);
    const states = {};
    let selected = Math.max(
        0,
        Math.min(19, Number(params.get("set") || 1) - 1),
    );
    const eye =
        '<svg width="13" height="9" viewBox="0 0 18 12"><path d="M1 6Q9-3 17 6Q9 15 1 6Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="6" r="2.5" fill="currentColor"/></svg>';
    const leg =
        '<svg width="10" height="12" viewBox="0 0 12 16"><path d="M6 1h4L9 10q0 1-2 2l-4 3-2-1q-1-2 2-3l2-2Z" fill="currentColor"/></svg>';
    const paintKey = (c) => [c.x + c.y, c.z, c.x];
    const compare = (a, b) => {
        const aa = paintKey(a),
            bb = paintKey(b);
        return aa[0] - bb[0] || aa[1] - bb[1] || aa[2] - bb[2];
    };
    function point(c) {
        const p = data.projection;
        return [
            (c.x - c.y) * p.xStep,
            (c.x + c.y) * p.yStep - c.z * p.layerStep,
        ];
    }
    function projectedCover(cards) {
        const { xStep: x, yStep: y, thickness: t } = data.projection;
        const faces = cards.map((c) => {
            const [px, py] = point(c);
            return [
                [px, py],
                [px + x, py + y],
                [px, py + 2 * y],
                [px - x, py + y],
            ];
        });
        const bodies = faces.map((f) => [
            f[0],
            f[1],
            [f[1][0], f[1][1] + t],
            [f[2][0], f[2][1] + t],
            [f[3][0], f[3][1] + t],
            f[3],
        ]);
        const sorted = cards.map((c, id) => ({ ...c, id })).sort(compare);
        const rank = new Map(sorted.map((c, i) => [c.id, i]));
        function intersects(a, b) {
            for (const poly of [a, b])
                for (let i = 0; i < poly.length; i++) {
                    const p = poly[i],
                        q = poly[(i + 1) % poly.length];
                    const nx = -(q[1] - p[1]),
                        ny = q[0] - p[0];
                    const aa = a.map(([xx, yy]) => xx * nx + yy * ny);
                    const bb = b.map(([xx, yy]) => xx * nx + yy * ny);
                    if (
                        Math.min(Math.max(...aa), Math.max(...bb)) <=
                        Math.max(Math.min(...aa), Math.min(...bb)) + 1e-8
                    )
                        return false;
                }
            return true;
        }
        return faces.map((face, i) =>
            cards.flatMap((_, j) =>
                rank.get(j) > rank.get(i) && intersects(face, bodies[j])
                    ? [j]
                    : [],
            ),
        );
    }
    function newState(level) {
        const covers = projectedCover(level.cards);
        if (JSON.stringify(covers) !== JSON.stringify(level.blockers))
            throw new Error("浏览器与关卡数据的投影遮挡不一致");
        if (level.cards.some((c) => c.z >= data.grid.maxLayers))
            throw new Error("实际层数超过声明配置");
        return {
            covers,
            level,
            left: new Set(level.cards.map((_, i) => i)),
            slot: [],
            q: 0,
            ended: false,
            message: "",
            hint: -1,
        };
    }
    function free(s, i) {
        return s.left.has(i) && !s.covers[i].some((j) => s.left.has(j));
    }
    function board(s) {
        const { xStep: X, yStep: Y, thickness: T } = data.projection;
        const corners = s.level.cards.flatMap((c) => {
            const [x, y] = point(c);
            return [
                [x - X - 2, y - 3],
                [x + X + 2, y + 2 * Y + T + 2],
            ];
        });
        const minX = Math.min(...corners.map((p) => p[0])) - 14;
        const minY = Math.min(...corners.map((p) => p[1])) - 30;
        const width = Math.max(...corners.map((p) => p[0])) - minX + 14;
        const height = Math.max(...corners.map((p) => p[1])) - minY + 30;
        // Small opening structures stay small instead of filling the whole screen.
        const vbWidth = Math.max(width, 220),
            vbHeight = Math.max(height, 265);
        const vbX = minX - (vbWidth - width) / 2,
            vbY = minY - (vbHeight - height) / 2;
        const tiles = s.level.cards
            .map((c, i) => ({ ...c, id: i }))
            .sort(compare)
            .filter((c) => s.left.has(c.id));
        let content = "";
        const footprint = data.packs[selected]?.decorativeFootprint;
        if (s.level.cards.length === 48 && footprint) {
            const paths = footprint
                .flatMap((row, y) =>
                    row.flatMap((filled, x) => {
                        if (!filled) return [];
                        const [px, py] = point({ x, y, z: -0.5 });
                        return [
                            `M${px},${py} l${X},${Y} ${-X},${Y} ${-X},${-Y}Z`,
                        ];
                    }),
                )
                .join(" ");
            content += `<g class="decorative-base" aria-hidden="true" pointer-events="none" transform="translate(-14 48) scale(0.5)"><path d="${paths}" fill="${data.packs[selected].color}" opacity="0.18"/></g>`;
        }
        for (const c of tiles) {
            const [x, y] = point(c),
                a = data.animals[c.animal],
                col = c.animal % 6,
                row = Math.floor(c.animal / 6);
            const stateClass = free(s, c.id) ? "playable" : "blocked";
            const clip = `face-${s.level.cards.length}-${c.id}`;
            content += `<g class="tile ${stateClass} ${s.hint === c.id ? "hint" : ""}" data-card="${c.id}" role="button" tabindex="${free(s, c.id) ? 0 : -1}" aria-label="${a.name}，${a.eyes}只眼睛，${a.legs}条腿" transform="translate(${x} ${y})">
                <title>${a.name} · 眼 ${a.eyes} / 腿 ${a.legs} · ${free(s, c.id) ? "可取" : "被覆盖"}</title>
                <polygon points="0,2 ${X + 1},${Y + 2} 0,${2 * Y + T + 2} ${-X - 1},${Y + T + 2}" fill="#728c6925"/>
                <polygon points="${-X},${Y} 0,${2 * Y} 0,${2 * Y + T} ${-X},${Y + T}" fill="#b3c49e" stroke="#849c7f" stroke-width=".55"/>
                <polygon points="0,${2 * Y} ${X},${Y} ${X},${Y + T} 0,${2 * Y + T}" fill="#8fa986" stroke="#789373" stroke-width=".55"/>
                <polygon class="tile-face" points="0,0 ${X},${Y} 0,${2 * Y} ${-X},${Y}" fill="#fffaf0" stroke="#aab69a" stroke-width=".65"/>
                <defs><clipPath id="${clip}"><polygon points="0,1 ${X - 1},${Y} 0,${2 * Y - 1} ${-X + 1},${Y}"/></clipPath></defs>
                <g clip-path="url(#${clip})">
                    <svg class="animal" x="-11" y="0" width="22" height="18" viewBox="${col * 256} ${row * 256} 256 256"><image href="animal-atlas.png" width="1536" height="1024"/></svg>
                    <rect x="-18" y="10" width="36" height="14" rx="3" fill="#fffaf0ee"/>
                    <path d="M-16 16Q-12 11 -8 16Q-12 21 -16 16Z" fill="none" stroke="#766748" stroke-width="0.9"/>
                    <circle cx="-12" cy="16" r="1.5" fill="#766748"/>
                    <text class="tile-stats" x="-6" y="21" fill="#766748" font-size="10.5" font-weight="650" font-family="system-ui">${a.eyes}</text>
                    <path d="M3 12h3L5 18 2 21 0 20 3 17Z" fill="#766748"/>
                    <text class="tile-stats" x="10" y="21" fill="#766748" font-size="10.5" font-weight="650" font-family="system-ui">${a.legs}</text>
                </g>
            </g>`;
        }
        return `<svg viewBox="${vbX} ${vbY} ${vbWidth} ${vbHeight}" aria-label="立体麻将牌结构">${content}</svg>`;
    }
    function question(t, next) {
        return `<div class="question ${next ? "next" : "current"}"><small>${next ? "下一题" : "当前题"}</small><strong>${t ? `<span>${eye}${t.eyes}</span><span>${leg}${t.legs}</span>` : "完成"}</strong></div>`;
    }
    function sprite(animal) {
        return `<div class="sprite" style="background-position:${(animal % 6) * 20}% ${Math.floor(animal / 6) * (100 / 3)}%"></div>`;
    }
    function renderStage(kind) {
        const s = states[kind],
            easy = kind === "easy",
            pack = data.packs[selected];
        const q = Math.min(s.q + 1, s.level.targets.length);
        const cells = Array.from({ length: 7 }, (_, i) => {
            const card = s.slot[i],
                a =
                    card === undefined
                        ? null
                        : data.animals[s.level.cards[card].animal];
            return `<div class="slot-cell ${a ? "filled" : ""}">${a ? `${sprite(s.level.cards[card].animal)}<div class="stats">眼${a.eyes} 腿${a.legs}</div>` : ""}</div>`;
        }).join("");
        const result = s.ended
            ? `<div class="result"><div><h3>${s.q === s.level.targets.length ? "搭得漂亮！" : "卡槽满了"}</h3><p>${s.q === s.level.targets.length ? "这座小世界已经全部消除。" : "本局结束，没有复活。可以重新体验或查看参考解。"}</p><button data-action="reset" data-kind="${kind}">重新体验</button></div></div>`
            : "";
        document.getElementById(`demo-${kind}`).innerHTML =
            `<div class="caption"><b>${easy ? "第一关 · 轻松上手" : "第二关 · 立体挑战"}</b><span>${easy ? "7 张 / 3 题" : "48 张 / 12 题"}</span></div>
            <div class="phone" style="--accent:${pack.color}">
                <div class="status"><span>9:41</span><span class="capsule">••• │ ◉</span></div>
                <div class="brand">腿了个腿</div><div class="stage">${pack.name} · ${easy ? "第一关" : "第二关"} ${q}/${s.level.targets.length}</div>
                <div class="progress"><i style="width:${(100 * s.q) / s.level.targets.length}%"></i></div>
                <div class="questions">${question(s.level.targets[s.q], false)}${question(s.level.targets[s.q + 1], true)}</div>
                <div class="board">${board(s)}</div><div class="board-note">${s.message || (easy ? "点任意亮牌，眼睛和腿都刚好就消除" : "先观察结构，再安排取牌顺序")}</div>
                <div class="slot-label"><strong>卡槽</strong><span>${s.slot.length}/7</span></div><div class="slot">${cells}</div>
                <div class="storage">暂存区</div><div class="tools"><span class="tool">↥ 移出</span><span class="tool">↶ 回退</span><span class="tool">⇄ 重排</span></div><div class="footer">${easy ? "第一关不使用道具" : "关卡结构设计预览"}</div>${result}
            </div><div class="controls"><button data-action="reset" data-kind="${kind}">重置</button><button data-action="hint" data-kind="${kind}">参考下一张</button><button data-action="replay" data-kind="${kind}">重放完整参考解</button></div>`;
    }
    function take(kind, id) {
        const s = states[kind];
        if (s.ended || !free(s, id)) return;
        s.left.delete(id);
        s.slot.push(id);
        s.hint = -1;
        const eyes = s.slot.reduce(
            (n, i) => n + data.animals[s.level.cards[i].animal].eyes,
            0,
        );
        const legs = s.slot.reduce(
            (n, i) => n + data.animals[s.level.cards[i].animal].legs,
            0,
        );
        const t = s.level.targets[s.q];
        if (eyes === t.eyes && legs === t.legs) {
            s.q++;
            s.slot = [];
            s.message = "刚好！这一题完成了";
            if (s.q === s.level.targets.length) s.ended = true;
        } else if (s.slot.length === 7) {
            s.ended = true;
        } else s.message = `卡槽合计：${eyes} 只眼睛 · ${legs} 条腿`;
        renderStage(kind);
    }
    function select(index) {
        selected = index;
        const pack = data.packs[index];
        states.easy = newState(pack.easy);
        states.hard = newState(pack.hard);
        document
            .querySelectorAll(".pack")
            .forEach((b, i) => b.classList.toggle("active", i === index));
        document.getElementById("selection").innerHTML =
            `<div><h2>${String(index + 1).padStart(2, "0")} / ${pack.name}</h2><p>${pack.description}</p></div><span class="badge">${pack.hard.layers} 层结构 · 开局 ${pack.hard.initialClickable} 张可取</span>`;
        document.getElementById("screens").innerHTML =
            '<article class="demo" id="demo-easy"></article><article class="demo" id="demo-hard"></article>';
        renderStage("easy");
        renderStage("hard");
    }
    document.getElementById("picker").innerHTML = data.packs
        .map(
            (p, i) =>
                `<button class="pack" data-set="${i}"><strong>${String(i + 1).padStart(2, "0")}</strong>${p.name}</button>`,
        )
        .join("");
    document.addEventListener("click", async (event) => {
        const set = event.target.closest("[data-set]");
        if (set) {
            select(Number(set.dataset.set));
            return;
        }
        const card = event.target.closest("[data-card]");
        if (card) {
            take(card.closest(".demo").id.slice(5), Number(card.dataset.card));
            return;
        }
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const kind = button.dataset.kind,
            action = button.dataset.action;
        if (action === "reset" || action === "replay")
            states[kind] = newState(data.packs[selected][kind]);
        if (action === "hint") {
            const s = states[kind];
            const remaining =
                s.level.reference[s.q]?.filter(
                    (i) => s.left.has(i) && free(s, i),
                ) || [];
            s.hint = remaining[0] ?? -1;
            s.message = "参考解只适用于按参考顺序进行的牌局；可先重置";
        }
        renderStage(kind);
        if (action === "replay") {
            const current = states[kind];
            for (const group of current.level.reference)
                for (const id of group) {
                    if (states[kind] !== current) return;
                    take(kind, id);
                    await new Promise((resolve) => setTimeout(resolve, 110));
                }
        }
    });
    document.addEventListener("keydown", (event) => {
        if (
            (event.key === "Enter" || event.key === " ") &&
            event.target.matches("[data-card]")
        ) {
            event.preventDefault();
            event.target.dispatchEvent(
                new MouseEvent("click", { bubbles: true }),
            );
        }
    });
    window.levelGallery = {
        select,
        states,
        take,
        board,
        projectedCover,
        point,
        data,
    };
    select(selected);
})();
