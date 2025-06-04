// ==================================
// p5.js 三國群英傳 - 強化版 v2.0
// ==================================

// --- 遊戲設定與常數 ---
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
const UI_WIDTH = 200; // 右側 UI 區域寬度
const MAP_WIDTH = CANVAS_WIDTH - UI_WIDTH;
const MESSAGE_LOG_HEIGHT = 100; // 底部訊息區域高度
const BATTLE_AREA_HEIGHT = CANVAS_HEIGHT - MESSAGE_LOG_HEIGHT;

const PLAYER_FACTION_ID = 0; // 玩家勢力 ID
const AI_FACTIONS = [1, 2]; // AI 勢力 ID 列表

// 遊戲狀態
let gameState = 'MAP'; // MAP, INTERNAL_AFFAIRS, BATTLE_PREP, BATTLE, GAME_OVER, MAP_SELECT_TARGET

// 遊戲資料
let cities = [];
let factions = [];
let generals = []; // 所有武將列表
let currentTurn = PLAYER_FACTION_ID;
let gameYear = 184;
let gameMonth = 1;
let messageLog = ["遊戲開始！"];

// 玩家互動狀態
let selectedCity = null; // 玩家在 MAP 狀態下選擇的城市
let targetCity = null; // 玩家選擇攻擊的目標城市
let internalAffairsCards = []; // 當前顯示的內政卡片
let availableGenerals = []; // 可指派的武將 (簡化)

// --- 強化後的戰鬥相關設定 ---
const SOLDIERS_PER_UNIT = 50; // 每一個戰鬥單位代表的士兵數
const BATTLE_DURATION_TARGET_FRAMES = 180 * 60; // 目標戰鬥時間 (約 3 分鐘 @60FPS)
const BASE_MOVE_SPEED = 0.8;
const BASE_ATTACK_COOLDOWN = 60; // frames
const DAMAGE_TEXT_DURATION = 45; // frames
const UNIT_VISUAL_SIZE = 10; // 單位視覺大小
const GRID_SIZE = 40; // 戰場網格大小
const DIALOGUE_DURATION = 120; // 對話框持續時間 (frames)
const MAX_GENERALS_PER_BATTLE = 3; // 每場戰鬥最多武將數
    const barHeight = 20;
    const barMargin = 10;
    const barY = 10;


// 兵種定義 (基礎數值)
const UnitTypes = {
    SPEARMAN: { name: '槍兵', hp: 120, attack: 15, defense: 10, speed: 1.0, range: 15, color: [100, 100, 255], shape: 'triangle', vsCavalryBonus: 1.5 },
    SHIELDMAN: { name: '盾兵', hp: 200, attack: 8, defense: 20, speed: 0.8, range: 12, color: [100, 100, 100], shape: 'rect', vsArcherResist: 0.7 },
    CAVALRY: { name: '騎兵', hp: 150, attack: 18, defense: 8, speed: 1.8, range: 18, color: [255, 100, 100], shape: 'ellipse', chargeBonus: 1.8, chargeCooldown: 180 },
    ARCHER: { name: '弓兵', hp: 80, attack: 12, defense: 5, speed: 1.0, range: 150, color: [0, 150, 0], shape: 'ellipse', stationaryAttackBonus: 1.2 },
};

// 戰鬥相關狀態 (擴充)
let battleState = {
    attacker: null, // { factionId, cityId, soldiers, generals, unitComposition: {SPEARMAN: 0.4, ...} }
    defender: null, // { factionId, cityId, soldiers, generals, unitComposition: {SHIELDMAN: 0.5, ...} }
    attackerUnits: [], // 戰鬥畫面中的 Unit 物件
    defenderUnits: [],
    battlePhase: 'DEPLOY', // DEPLOY, FIGHTING, END
    battleTimer: 0,
    battleWinner: null,
    playerCommand: null, // 玩家的戰鬥指令 (e.g., 'charge', 'skill_1', 'formation_1')
    damageTexts: [], // { text, x, y, timer, color }
    battlefieldEffects: [], // 用於技能特效等 { type, x, y, radius, duration, color, ownerUnit? }
    lastGeneralSkillTime: {}, // { generalId: frameCount }
    projectiles: [], // <--- 新增：用於存放箭矢等飛行物
    dialogues: [], // { text, x, y, timer }

};

// --- p5.js 主要函式 ---

function preload() {
    // loadImage('path/to/map_background.png');
    // loadFont('path/to/font.ttf');
}

function setup() {
    createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    initializeGameData();
    textFont("SimSun"); // 使用宋體或系統預設中文字體
    textSize(14);
    textAlign(CENTER, CENTER);
    frameRate(60); // 固定幀率以便計算時間
    console.log("遊戲設定完成，畫布大小:", CANVAS_WIDTH, CANVAS_HEIGHT);
}

function draw() {
    background(220);

    switch (gameState) {
        case 'MAP':
        case 'MAP_SELECT_TARGET':
            drawMapScreen();
            break;
        case 'INTERNAL_AFFAIRS':
            drawInternalAffairsScreen();
            break;
        case 'BATTLE_PREP':
            drawBattlePrepScreen();
            break;
        case 'BATTLE':
            updateBattle(); // **戰鬥邏輯更新放在繪製前**
            drawBattleScreen(); // **繪製戰鬥畫面**
            break;
        case 'GAME_OVER':
            drawGameOverScreen();
            break;
    }

    drawUIPanel();
    drawMessageLog();
    updateAnimations(); // 更新通用動畫 (非戰鬥單位)
}

function mousePressed() {
    switch (gameState) {
        case 'MAP':
        case 'MAP_SELECT_TARGET':
            handleMapClick();
            break;
        case 'INTERNAL_AFFAIRS':
            handleInternalAffairsClick();
            break;
        case 'BATTLE_PREP':
            handleBattlePrepClick();
            break;
        case 'BATTLE':
            handleBattleClick();
            break;
        case 'GAME_OVER':
            handleGameOverClick();
            break;
    }
}

// --- 遊戲初始化 ---

function initializeGameData() {
    console.log("Initializing game data...");
    factions = [
        { id: PLAYER_FACTION_ID, name: "玩家", color: color(0, 100, 255), isAI: false, citiesCount: 0 },
        { id: 1, name: "曹操", color: color(220, 50, 50), isAI: true, citiesCount: 0 },
        { id: 2, name: "劉備", color: color(50, 200, 50), isAI: true, citiesCount: 0 },
    ];

    generals = [
        // 關羽 - 軍神 + 新增一個防禦性或輔助技能
        { id: 1, name: "關羽", attack: 97, defense: 95, leadership: 90, factionId: 2, location: null,
          skills: [
              { name: "軍神", type: 'aoe_damage', value: 150, range: 100, duration: 1, cooldown: 0, maxCooldown: 15 * 60 },
              { name: "武聖", type: 'self_buff', value: 1.4, range: 0, duration: 10 * 60, cooldown: 0, maxCooldown: 20 * 60 } // 強化自身攻防
          ]},
        // 張飛 - 咆哮 + 單體高傷
        { id: 2, name: "張飛", attack: 98, defense: 85, leadership: 70, factionId: 2, location: null,
          skills: [
              { name: "咆哮", type: 'debuff_area', value: 0.7, range: 120, duration: 10 * 60, cooldown: 0, maxCooldown: 18 * 60 },
              { name: "斷喝", type: 'single_damage', value: 300, range: 40, duration: 1, cooldown: 0, maxCooldown: 12 * 60 } // 對近距離單體造成高傷害
          ]},
        // 趙雲 - 龍膽 + 衝鋒技能
        { id: 3, name: "趙雲", attack: 96, defense: 92, leadership: 85, factionId: 2, location: null,
          skills: [
              { name: "龍膽", type: 'self_buff', value: 1.5, range: 0, duration: 12 * 60, cooldown: 0, maxCooldown: 20 * 60 },
              { name: "七探蛇盤", type: 'charge_attack', value: 1.8, range: 100, duration: 5*60, cooldown: 0, maxCooldown: 16 * 60 } // 短時提升衝鋒傷害和範圍
          ]},
        // 曹操 - 治世能臣 + 削弱敵軍防禦
        { id: 4, name: "曹操", attack: 72, defense: 90, leadership: 95, factionId: 1, location: null,
          skills: [
              { name: "治世能臣", type: 'buff_area', value: 1.2, range: 130, duration: 15 * 60, cooldown: 0, maxCooldown: 22 * 60 },
              { name: "奸雄", type: 'debuff_area_def', value: 0.75, range: 110, duration: 10 * 60, cooldown: 0, maxCooldown: 19 * 60 } // 降低範圍敵人防禦
          ]},
        // 夏侯惇 - 剛烈 + 範圍小傷害
        { id: 5, name: "夏侯惇", attack: 93, defense: 88, leadership: 80, factionId: 1, location: null,
          skills: [
              { name: "剛烈", type: 'damage_reflect', value: 0.3, range: 90, duration: 15 * 60, cooldown: 0, maxCooldown: 18 * 60 }, // 反傷範圍改為影響友軍
              { name: "拔矢啖睛", type: 'aoe_damage', value: 80, range: 70, duration: 1, cooldown: 0, maxCooldown: 14 * 60 } // 自身周圍小範圍傷害
          ]},
        // 玩家武將 A - 奮戰 + ***箭雨***
        { id: 6, name: "玩家武將A", attack: 85, defense: 80, leadership: 75, factionId: 0, location: null,
          skills: [
              { name: "奮戰", type: 'buff_area', value: 1.15, range: 90, duration: 10 * 60, cooldown: 0, maxCooldown: 16 * 60 },
              { name: "箭雨", type: 'aoe_damage_arrows', value: 40, range: 120, duration: 1, cooldown: 0, maxCooldown: 25 * 60 } // value=箭數, range=範圍半徑
          ]},
        // 玩家武將 B - 堅守 + 治療
        { id: 7, name: "玩家武將B", attack: 78, defense: 88, leadership: 82, factionId: 0, location: null,
          skills: [
              { name: "堅守", type: 'buff_area_def', value: 1.3, range: 90, duration: 10 * 60, cooldown: 0, maxCooldown: 17 * 60 },
              { name: "醫術", type: 'heal_area', value: 50, range: 80, duration: 1, cooldown: 0, maxCooldown: 20 * 60 } // 範圍治療 value=治療量
          ]},
    ];
    availableGenerals = [...generals];

    cities = [
        { id: 1, name: "洛陽", x: 400, y: 200, owner: 1, soldiers: 15000, food: 10000, defense: 50, generals: [], isSelected: false, isTargeted: false, adjacent: [2, 3, 4], unitComposition: { SPEARMAN: 0.3, SHIELDMAN: 0.4, CAVALRY: 0.1, ARCHER: 0.2 } },
        { id: 2, name: "長安", x: 250, y: 220, owner: 1, soldiers: 12000, food: 8000, defense: 60, generals: [], isSelected: false, isTargeted: false, adjacent: [1, 5], unitComposition: { SPEARMAN: 0.4, SHIELDMAN: 0.3, CAVALRY: 0.2, ARCHER: 0.1 } },
        { id: 3, name: "許昌", x: 450, y: 300, owner: 1, soldiers: 18000, food: 12000, defense: 55, generals: [], isSelected: false, isTargeted: false, adjacent: [1, 4, 6], unitComposition: { SPEARMAN: 0.2, SHIELDMAN: 0.5, CAVALRY: 0.1, ARCHER: 0.2 } },
        { id: 4, name: "鄴城", x: 550, y: 150, owner: 1, soldiers: 13000, food: 9000, defense: 45, generals: [], isSelected: false, isTargeted: false, adjacent: [1, 3, 7], unitComposition: { SPEARMAN: 0.3, SHIELDMAN: 0.2, CAVALRY: 0.3, ARCHER: 0.2 } },
        { id: 5, name: "成都", x: 150, y: 400, owner: 2, soldiers: 20000, food: 15000, defense: 70, generals: [], isSelected: false, isTargeted: false, adjacent: [2, 8], unitComposition: { SPEARMAN: 0.5, SHIELDMAN: 0.3, CAVALRY: 0.1, ARCHER: 0.1 } },
        { id: 6, name: "建業", x: 650, y: 380, owner: PLAYER_FACTION_ID, soldiers: 25000, food: 20000, defense: 65, generals: [], isSelected: false, isTargeted: false, adjacent: [3, 7], unitComposition: { SPEARMAN: 0.3, SHIELDMAN: 0.3, CAVALRY: 0.2, ARCHER: 0.2 } },
        { id: 7, name: "北平", x: 600, y: 80, owner: PLAYER_FACTION_ID, soldiers: 16000, food: 11000, defense: 50, generals: [], isSelected: false, isTargeted: false, adjacent: [4, 6], unitComposition: { SPEARMAN: 0.2, SHIELDMAN: 0.2, CAVALRY: 0.4, ARCHER: 0.2 } },
        { id: 8, name: "雲南", x: 200, y: 500, owner: 2, soldiers: 10000, food: 6000, defense: 40, generals: [], isSelected: false, isTargeted: false, adjacent: [5], unitComposition: { SPEARMAN: 0.6, SHIELDMAN: 0.2, CAVALRY: 0.1, ARCHER: 0.1 } },
    ];

    assignGeneralToCity(findGeneralByName("曹操"), 1);
    assignGeneralToCity(findGeneralByName("夏侯惇"), 3);
    assignGeneralToCity(findGeneralByName("關羽"), 5);
    assignGeneralToCity(findGeneralByName("張飛"), 5);
    assignGeneralToCity(findGeneralByName("趙雲"), 5);
    assignGeneralToCity(findGeneralByName("玩家武將A"), 6);
    assignGeneralToCity(findGeneralByName("玩家武將B"), 7);

    updateFactionCityCounts();
    addMessage("遊戲資料初始化完畢 (v2.0)。");
    console.log("Game data initialized.");
}

// --- 繪圖函式 (部分保持不變，修改與戰鬥相關部分) ---

function drawMapScreen() {
    // ... (保持不變) ...
    // 1. 繪製地圖背景 (可替換為圖片)
    fill(200, 230, 200); // 綠色背景
    rect(0, 0, MAP_WIDTH, CANVAS_HEIGHT - MESSAGE_LOG_HEIGHT);

    // 2. 繪製城市連接線 (示意)
    stroke(150);
    strokeWeight(1);
    cities.forEach(city => {
        city.adjacent.forEach(adjId => {
            const adjCity = findCityById(adjId);
            if (adjCity) {
                line(city.x, city.y, adjCity.x, adjCity.y);
            }
        });
    });

    // 3. 繪製城市
    cities.forEach(city => {
        const faction = findFactionById(city.owner);
        if (faction) {
            fill(faction.color);
        } else {
            fill(128); // 中立/無主
        }
        stroke(0);
        strokeWeight(city.isSelected ? 3 : (city.isTargeted ? 2 : 1)); // 選中/目標時邊框加粗
        if (city.isTargeted) stroke(255,0,0); // 目標紅色邊框
        else stroke(0);

        ellipse(city.x, city.y, 40, 40); // 圓形代表城市

        // 城市名稱和兵力
        fill(0);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text(city.name, city.x, city.y - 25);
        textSize(10);
        // 改成顯示 K 或 W 單位
        let soldierDisplay = city.soldiers >= 10000 ? (city.soldiers / 10000).toFixed(1) + '萬' : (city.soldiers >= 1000 ? (city.soldiers/1000).toFixed(1) + '千' : city.soldiers);
        text(`兵:${soldierDisplay}`, city.x, city.y + 25);
    });
    noStroke();

    // 4. 顯示選中城市的詳細資訊 (如果有的話)
    if (selectedCity && selectedCity.owner === PLAYER_FACTION_ID) {
        fill(255, 255, 200, 200); // 半透明黃色背景
        rect(10, 10, 180, 150, 5);
        fill(0);
        textAlign(LEFT, TOP);
        textSize(14);
        text(`城市: ${selectedCity.name}`, 20, 20);
        text(`勢力: ${findFactionById(selectedCity.owner).name}`, 20, 40);
        text(`士兵: ${selectedCity.soldiers.toLocaleString()}`, 20, 60);
        text(`糧草: ${selectedCity.food.toLocaleString()}`, 20, 80);
        text(`防禦: ${selectedCity.defense}`, 20, 100);
        text(`武將: ${selectedCity.generals.map(g => g.name).join(', ') || '無'}`, 20, 120);
        textAlign(CENTER, CENTER); // 恢復預設對齊
    } else if (selectedCity) {
        // 顯示敵方或中立城市簡略資訊
        fill(200, 200, 200, 200);
        rect(10, 10, 180, 100, 5);
        fill(0);
        textAlign(LEFT, TOP);
        textSize(14);
        text(`城市: ${selectedCity.name}`, 20, 20);
        const ownerFaction = findFactionById(selectedCity.owner);
        text(`勢力: ${ownerFaction ? ownerFaction.name : '無'}`, 20, 40);
        text(`士兵: ${selectedCity.soldiers.toLocaleString()}`, 20, 60);
        text(`防禦: ${selectedCity.defense}`, 20, 80);
        textAlign(CENTER, CENTER);
    }
}

function drawUIPanel() {
    // ... (基本不變，稍微調整按鈕可用性判斷) ...
    const uiX = MAP_WIDTH;
    const uiY = 0;

    // 繪製 UI 背景
    fill(180);
    rect(uiX, uiY, UI_WIDTH, CANVAS_HEIGHT - MESSAGE_LOG_HEIGHT);

    // 顯示當前回合和時間
    fill(0);
    textSize(14);
    textAlign(CENTER, TOP);
    text(`第 ${gameYear} 年 ${gameMonth} 月`, uiX + UI_WIDTH / 2, 10);
    const currentFaction = findFactionById(currentTurn);
    if (currentFaction) {
        fill(currentFaction.color);
        text(`${currentFaction.name} 回合`, uiX + UI_WIDTH / 2, 35);
    } else {
        fill(100);
        text(`未知勢力回合`, uiX + UI_WIDTH / 2, 35);
    }


    // --- 按鈕 ---
    const btnYStep = 60;
    let currentBtnY = 80;
    const btnW = UI_WIDTH - 40;
    const btnH = 40;

    // 內政按鈕
    let internalAffairsEnabled = currentTurn === PLAYER_FACTION_ID && selectedCity && selectedCity.owner === PLAYER_FACTION_ID && gameState === 'MAP';
    fill(internalAffairsEnabled ? color(100, 200, 100) : color(150));
    rect(uiX + 20, currentBtnY, btnW, btnH, 5);
    fill(internalAffairsEnabled ? 0 : 100);
    textSize(16);
    textAlign(CENTER, CENTER);
    text("內政", uiX + UI_WIDTH / 2, currentBtnY + btnH / 2);
    currentBtnY += btnYStep;

    // 戰鬥按鈕
    let battleEnabled = currentTurn === PLAYER_FACTION_ID && selectedCity && selectedCity.owner === PLAYER_FACTION_ID && gameState === 'MAP';
    fill(battleEnabled ? color(200, 100, 100) : color(150));
    rect(uiX + 20, currentBtnY, btnW, btnH, 5);
    fill(battleEnabled ? 0 : 100);
    text("戰鬥", uiX + UI_WIDTH / 2, currentBtnY + btnH / 2);
    currentBtnY += btnYStep;

    // 回合結束按鈕
    let endTurnEnabled = currentTurn === PLAYER_FACTION_ID && gameState === 'MAP';
    fill(endTurnEnabled ? color(100, 100, 200) : color(150));
    rect(uiX + 20, currentBtnY, btnW, btnH, 5);
    fill(endTurnEnabled ? 0 : 100);
    text("回合結束", uiX + UI_WIDTH / 2, currentBtnY + btnH / 2);
    currentBtnY += btnYStep;

    // --- 其他資訊 (可選) ---
    fill(0);
    textAlign(LEFT, TOP);
    textSize(12);
    text("訊息提示:", uiX + 10, currentBtnY);
    // ...

    textAlign(CENTER, CENTER); // 恢復
}

function drawMessageLog() {
    // ... (保持不變) ...
    const logX = 0;
    const logY = CANVAS_HEIGHT - MESSAGE_LOG_HEIGHT;
    const logW = CANVAS_WIDTH;
    const logH = MESSAGE_LOG_HEIGHT;

    fill(50);
    rect(logX, logY, logW, logH);

    fill(255);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    const maxLines = floor((logH - 10) / 15); // 計算可顯示的最大行數
    const startIndex = max(0, messageLog.length - maxLines);
    for (let i = 0; i < maxLines && (startIndex + i) < messageLog.length; i++) {
        text(messageLog[startIndex + i], logX + 10, logY + 20 + i * 15);
    }
    textAlign(CENTER, CENTER); // 恢復
}

function drawInternalAffairsScreen() {
    // ... (基本不變) ...
        // 1. 半透明遮罩
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);

    // 2. 顯示標題和所選城市
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text(`${selectedCity.name} - 內政指令`, width / 2, 50);

    // 3. 繪製卡片
    const cardWidth = 150;
    const cardHeight = 200;
    const startX = (width - (internalAffairsCards.length * cardWidth + (internalAffairsCards.length - 1) * 20)) / 2;
    const startY = 150;

    internalAffairsCards.forEach((card, index) => {
        const cardX = startX + index * (cardWidth + 20);
        // 卡片背景
        fill(200, 200, 150);
        rect(cardX, startY, cardWidth, cardHeight, 10);

        // 卡片內容
        fill(0);
        textSize(16);
        textAlign(CENTER, TOP);
        text(card.title, cardX + cardWidth / 2, startY + 20);
        textSize(12);
        textAlign(CENTER, CENTER);
        // 將描述文本換行繪製
        let lines = card.description.split('\n');
        for(let i = 0; i < lines.length; i++) {
            text(lines[i], cardX + cardWidth / 2, startY + 60 + i * 15);
        }
        textSize(14);
        textAlign(CENTER, BOTTOM);
        text(`花費: ${card.costFood || 0}糧 / ${card.costGold || 0}金`, cardX + cardWidth/2, startY + cardHeight - 20); // 假設有花費
    });

    // 4. 返回按鈕
    const backButton = { x: width - 120, y: height - 60, w: 100, h: 40 };
    fill(180);
    rect(backButton.x, backButton.y, backButton.w, backButton.h, 5);
    fill(0);
    textSize(16);
    text("返回地圖", backButton.x + backButton.w / 2, backButton.y + backButton.h / 2);
}

function drawBattlePrepScreen() {
    // ... (基本不變) ...
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);

    const attackerFaction = findFactionById(battleState.attacker.factionId);
    const defenderFaction = findFactionById(battleState.defender.factionId);
    const attackerCity = findCityById(battleState.attacker.cityId);
    const defenderCity = findCityById(battleState.defender.cityId);

    // 顯示標題
    fill(255);
    textSize(28);
    textAlign(CENTER, CENTER);
    text("戰鬥準備", width / 2, 50);
    textSize(20);
    text(`${attackerCity.name}  VS  ${defenderCity.name}`, width / 2, 100);

    // 顯示雙方資訊
    const boxWidth = 300;
    const boxHeight = 250;
    const attackerX = width / 2 - boxWidth - 50;
    const defenderX = width / 2 + 50;
    const boxY = 150;

    // 攻擊方
    fill(attackerFaction.color);
    rect(attackerX, boxY, boxWidth, boxHeight, 10);
    fill(0);
    textSize(18);
    textAlign(CENTER, TOP);
    text(`攻擊方: ${attackerFaction.name}`, attackerX + boxWidth / 2, boxY + 30);
    textSize(14);
    textAlign(LEFT, TOP);
    text(`城市: ${attackerCity.name}`, attackerX + 20, boxY + 70);
    text(`兵力: ${battleState.attacker.soldiers.toLocaleString()}`, attackerX + 20, boxY + 100);
    text(`  (約 ${floor(battleState.attacker.soldiers / SOLDIERS_PER_UNIT)} 單位)`, attackerX + 20, boxY + 120);
    text(`武將: ${battleState.attacker.generals.map(g => g.name).join(', ') || '無'}`, attackerX + 20, boxY + 150);

    // 防守方
    fill(defenderFaction.color);
    rect(defenderX, boxY, boxWidth, boxHeight, 10);
    fill(0);
    textSize(18);
    textAlign(CENTER, TOP);
    text(`防守方: ${defenderFaction.name}`, defenderX + boxWidth / 2, boxY + 30);
    textSize(14);
    textAlign(LEFT, TOP);
    text(`城市: ${defenderCity.name}`, defenderX + 20, boxY + 70);
    text(`兵力: ${battleState.defender.soldiers.toLocaleString()}`, defenderX + 20, boxY + 100);
    text(`  (約 ${floor(battleState.defender.soldiers / SOLDIERS_PER_UNIT)} 單位)`, defenderX + 20, boxY + 120);
    text(`武將: ${battleState.defender.generals.map(g => g.name).join(', ') || '無'}`, defenderX + 20, boxY + 150);

    // 按鈕
    const btnW = 150;
    const btnH = 50;
    const btnY = boxY + boxHeight + 50;
    const startBtnX = width / 2 - btnW - 20;
    const cancelBtnX = width / 2 + 20;

    // 開始戰鬥按鈕
    fill(100, 200, 100);
    rect(startBtnX, btnY, btnW, btnH, 5);
    fill(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    text("開始戰鬥", startBtnX + btnW / 2, btnY + btnH / 2);

    // 取消按鈕
    fill(200, 100, 100);
    rect(cancelBtnX, btnY, btnW, btnH, 5);
    fill(0);
    text("取消", cancelBtnX + btnW / 2, btnY + btnH / 2);
}

// ============================================
// ===== BATTLE SCREEN DRAWING (REVISED) ======
// ============================================
function drawBattleScreen() {
    // 1. 繪製戰鬥背景 (例如左右陣營顏色 + 中間漸層或分界)
    const midX = width / 2;
    // Attacker side background
    fill(red(battleState.attacker.color) * 0.3, green(battleState.attacker.color) * 0.3, blue(battleState.attacker.color) * 0.3);
    rect(0, 0, midX, BATTLE_AREA_HEIGHT);
    // Defender side background
    fill(red(battleState.defender.color) * 0.3, green(battleState.defender.color) * 0.3, blue(battleState.defender.color) * 0.3);
    rect(midX, 0, midX, BATTLE_AREA_HEIGHT);
    // Center line (optional)
    stroke(255, 100); strokeWeight(2);
    line(midX, 0, midX, BATTLE_AREA_HEIGHT);
    noStroke();

    // 繪製戰場網格
    stroke(255, 40);
    strokeWeight(1);
    for (let gx = GRID_SIZE; gx < width; gx += GRID_SIZE) {
        line(gx, 0, gx, BATTLE_AREA_HEIGHT);
    }
    for (let gy = GRID_SIZE; gy < BATTLE_AREA_HEIGHT; gy += GRID_SIZE) {
        line(0, gy, width, gy);
    }
    noStroke();

    // 2. 繪製雙方總兵力條 (更清晰)
    const barHeight = 20;
    const barMargin = 10;
    const barY = 10;

    // Attacker Bar
    let totalAttackerHP = battleState.attackerUnits.reduce((sum, unit) => sum + unit.hp, 0);
    let maxAttackerHP = battleState.attackerUnits.reduce((sum, unit) => sum + unit.maxHp, 0);
    if (maxAttackerHP === 0 && battleState.attacker.initialUnits > 0) maxAttackerHP = battleState.attacker.initialUnits * (UnitTypes.SPEARMAN.hp + UnitTypes.SHIELDMAN.hp + UnitTypes.CAVALRY.hp + UnitTypes.ARCHER.hp) / 4; // Estimate if empty
    let attackerRatio = maxAttackerHP > 0 ? totalAttackerHP / maxAttackerHP : 0;
    attackerRatio = constrain(attackerRatio, 0, 1);
    let attackerUnitsCount = battleState.attackerUnits.length;

    fill(50, 50, 50, 200);
    rect(barMargin, barY, midX - 2 * barMargin, barHeight, 3);
    fill(battleState.attacker.color);
    rect(barMargin, barY, (midX - 2 * barMargin) * attackerRatio, barHeight, 3);
    fill(255); textSize(12); textAlign(LEFT, CENTER);
    text(`兵力: ${attackerUnitsCount} (${(attackerRatio * 100).toFixed(0)}%)`, barMargin + 5, barY + barHeight / 2);

    // Defender Bar
    let totalDefenderHP = battleState.defenderUnits.reduce((sum, unit) => sum + unit.hp, 0);
    let maxDefenderHP = battleState.defenderUnits.reduce((sum, unit) => sum + unit.maxHp, 0);
     if (maxDefenderHP === 0 && battleState.defender.initialUnits > 0) maxDefenderHP = battleState.defender.initialUnits * (UnitTypes.SPEARMAN.hp + UnitTypes.SHIELDMAN.hp + UnitTypes.CAVALRY.hp + UnitTypes.ARCHER.hp) / 4; // Estimate if empty
    let defenderRatio = maxDefenderHP > 0 ? totalDefenderHP / maxDefenderHP : 0;
    defenderRatio = constrain(defenderRatio, 0, 1);
     let defenderUnitsCount = battleState.defenderUnits.length;

    fill(50, 50, 50, 200);
    rect(midX + barMargin, barY, midX - 2 * barMargin, barHeight, 3);
    fill(battleState.defender.color);
    // Draw from right to left
    rect(midX + barMargin + (midX - 2 * barMargin) * (1 - defenderRatio), barY, (midX - 2 * barMargin) * defenderRatio, barHeight, 3);
    fill(255); textSize(12); textAlign(RIGHT, CENTER);
    text(`兵力: ${defenderUnitsCount} (${(defenderRatio * 100).toFixed(0)}%)`, width - barMargin - 5, barY + barHeight / 2);


    // 3. 繪製單位 (調用 Unit 的 draw 方法)
    battleState.attackerUnits.forEach(unit => unit.draw());
    battleState.defenderUnits.forEach(unit => unit.draw());

    // --- 繪製飛行物 --- <--- 新增代碼塊
    if (battleState.projectiles) {
        battleState.projectiles.forEach(p => p.draw());
    }


    // 4. 繪製戰鬥特效 (例如技能範圍指示器)
    drawBattleEffects();

    // 5. 繪製傷害數字
    drawDamageTexts();
    // 繪製對話氣泡
    drawDialogues();

    // 6. 繪製武將區 (底部)
    drawGeneralsUI();

    // 7. 繪製戰鬥指令按鈕 (如果玩家參與戰鬥)
    drawBattleCommands();

    // 8. 顯示戰鬥結果 (如果結束)
    if (battleState.battlePhase === 'END') {
        fill(0, 0, 0, 180);
        rect(width / 4, height / 3, width / 2, height / 4, 10);
        fill(255);
        textSize(24);
        textAlign(CENTER, CENTER);
        const winnerFaction = findFactionById(battleState.battleWinner);
        text(winnerFaction ? `${winnerFaction.name} 勝利！` : "戰鬥結束！", width / 2, height / 3 + 40);
        textSize(16);
        text("點擊任意處返回地圖", width / 2, height / 3 + 80);
    }

    // Reset drawing styles
    textAlign(CENTER, CENTER);
    noStroke();
    fill(255);
}

function drawGeneralsUI() {
    const uiY = BATTLE_AREA_HEIGHT - 60;
    const generalSpacing = 120; // 拉開一點間距放兩個按鈕
    const generalIconSize = 30;
    const skillButtonH = 20;
    const skillButtonW = 55; // 稍微縮小按鈕寬度
    const skillButtonSpacing = 5; // 兩個按鈕間的間距

    // --- 攻擊方武將 ---
    if (battleState.attacker && battleState.attacker.generals) {
        const startX = 60; // 起始位置調整
        battleState.attacker.generals.forEach((gen, i) => {
            const genX = startX + i * generalSpacing;
            const genY = uiY;
            // ... (繪製武將圖標和名字不變) ...
            fill(battleState.attacker.color);
            ellipse(genX, genY, generalIconSize, generalIconSize);
            fill(255); textSize(12);
            text(gen.name, genX, genY + generalIconSize / 2 + 15);

            // --- 繪製技能按鈕 (最多兩個) ---
            if (gen.skills && gen.skills.length > 0) {
                const totalButtonWidth = gen.skills.length * skillButtonW + (gen.skills.length - 1) * skillButtonSpacing;
                const firstButtonX = genX - totalButtonWidth / 2;

                gen.skills.forEach((skill, skillIndex) => {
                    const skillBtnX = firstButtonX + skillIndex * (skillButtonW + skillButtonSpacing);
                    const skillBtnY = genY + generalIconSize / 2 + 30;
                    const isPlayerSide = battleState.attacker.factionId === PLAYER_FACTION_ID;
                    const canUseSkill = skill.cooldown === 0 && battleState.battlePhase === 'FIGHTING';
                    const skillKey = gen.id + '_' + skillIndex; // 唯一鍵
                    const isActive = battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] < skill.duration;

                    // 繪製按鈕背景
                    fill(canUseSkill ? color(100, 180, 255) : color(100, 100, 100, 150));
                    if (!isPlayerSide && !canUseSkill && !isActive) fill(100, 100, 100, 100); // AI 未就緒
                    if (isActive) fill(150, 120, 0, 180); // 持續中高亮 (雙方都顯示)
                    rect(skillBtnX, skillBtnY, skillButtonW, skillButtonH, 3);

                    // 繪製按鈕文字
                    fill(isPlayerSide ? (canUseSkill ? 0 : 50) : (isActive ? 255: 200)); // 根據狀態調整文字顏色
                    if (isActive) fill(255);

                    textSize(10);
                    let skillText = skill.name;
                    if (!canUseSkill && skill.cooldown > 0) {
                        skillText = `CD:${ceil(skill.cooldown / 60)}s`;
                         if (!isPlayerSide) fill(50); // AI冷卻中文字
                    }
                    if (isActive) {
                        skillText = `持續中`;
                    }
                    text(skillText, skillBtnX + skillButtonW / 2, skillBtnY + skillButtonH / 2);
                });
            }
        });
    } // End Attacker Generals

    // --- 防守方武將 (同理修改) ---
    if (battleState.defender && battleState.defender.generals) {
        const startX = width - 60; // 起始位置調整
        battleState.defender.generals.forEach((gen, i) => {
            const genX = startX - i * generalSpacing;
            const genY = uiY;
             // ... (繪製武將圖標和名字不變) ...
            fill(battleState.defender.color);
            ellipse(genX, genY, generalIconSize, generalIconSize);
            fill(255); textSize(12);
            text(gen.name, genX, genY + generalIconSize / 2 + 15);

            // --- 繪製技能按鈕 (最多兩個) ---
             if (gen.skills && gen.skills.length > 0) {
                const totalButtonWidth = gen.skills.length * skillButtonW + (gen.skills.length - 1) * skillButtonSpacing;
                const firstButtonX = genX - totalButtonWidth / 2;

                gen.skills.forEach((skill, skillIndex) => {
                    const skillBtnX = firstButtonX + skillIndex * (skillButtonW + skillButtonSpacing);
                    const skillBtnY = genY + generalIconSize / 2 + 30;
                    const isPlayerSide = battleState.defender.factionId === PLAYER_FACTION_ID;
                    const canUseSkill = skill.cooldown === 0 && battleState.battlePhase === 'FIGHTING';
                    const skillKey = gen.id + '_' + skillIndex;
                    const isActive = battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] < skill.duration;

                     // 繪製按鈕背景
                    fill(canUseSkill ? color(100, 180, 255) : color(100, 100, 100, 150));
                    if (!isPlayerSide && !canUseSkill && !isActive) fill(100, 100, 100, 100); // AI 未就緒
                    if (isActive) fill(150, 120, 0, 180); // 持續中高亮 (雙方都顯示)
                    rect(skillBtnX, skillBtnY, skillButtonW, skillButtonH, 3);

                    // 繪製按鈕文字
                    fill(isPlayerSide ? (canUseSkill ? 0 : 50) : (isActive ? 255: 200));
                    if (isActive) fill(255);

                    textSize(10);
                    let skillText = skill.name;
                    if (!canUseSkill && skill.cooldown > 0) {
                        skillText = `CD:${ceil(skill.cooldown / 60)}s`;
                        if (!isPlayerSide) fill(50);
                    }
                     if (isActive) {
                        skillText = `持續中`;
                    }
                    text(skillText, skillBtnX + skillButtonW / 2, skillBtnY + skillButtonH / 2);
                });
            }
        });
    } // End Defender Generals

    fill(255); // Reset color
}

function drawBattleCommands() {
    const isPlayerAttacker = battleState.attacker?.factionId === PLAYER_FACTION_ID;
    const isPlayerDefender = battleState.defender?.factionId === PLAYER_FACTION_ID;

    if ((isPlayerAttacker || isPlayerDefender) && battleState.battlePhase === 'FIGHTING') {
        const cmdBtnY = BATTLE_AREA_HEIGHT - 130; // 指令按鈕區域 Y
        const cmdBtnX = isPlayerAttacker ? 50 : width - 150 - 20; // 靠左或靠右
        const btnW = 80;
        const btnH = 30;
        const btnSpacing = 10;

        // 指令按鈕列表
        const commands = [
            { name: "突擊", command: "charge", color: color(255, 100, 0) },
            { name: "防守", command: "defend", color: color(0, 100, 200) },
            // { name: "後退", command: "retreat", color: color(150, 150, 150) }, // 可擴充
             { name: "標準", command: "standard", color: color(100, 150, 100) },
        ];

        commands.forEach((cmd, i) => {
            let currentBtnY = cmdBtnY + i * (btnH + btnSpacing);
             let isActive = battleState.playerCommand === cmd.command;
            fill(cmd.color);
             if (isActive) { // 高亮當前指令
                stroke(255,255,0);
                strokeWeight(2);
             } else {
                 noStroke();
             }
            rect(cmdBtnX, currentBtnY, btnW, btnH, 5);
            fill(isActive? 0 : 255); // 文字顏色反轉
            textSize(14);
            text(cmd.name, cmdBtnX + btnW / 2, currentBtnY + btnH / 2);
            noStroke();
        });
         fill(255); // Reset color
    }
}

function drawDamageTexts() {
    textAlign(CENTER, CENTER);
    for (let i = battleState.damageTexts.length - 1; i >= 0; i--) {
        let dt = battleState.damageTexts[i];
        dt.timer--;
        if (dt.timer <= 0) {
            battleState.damageTexts.splice(i, 1);
        } else {
            let alphaValue = map(dt.timer, 0, DAMAGE_TEXT_DURATION, 0, 255);
            let currentY = dt.y - (DAMAGE_TEXT_DURATION - dt.timer) * 0.5; // 文字上浮效果
            fill(red(dt.color), green(dt.color), blue(dt.color), alphaValue);
            textSize(12);
            text(dt.text, dt.x, currentY);
        }
    }
    fill(255); // Reset fill
}

function drawDialogues() {
    textAlign(CENTER, CENTER);
    for (let i = battleState.dialogues.length - 1; i >= 0; i--) {
        let dlg = battleState.dialogues[i];
        dlg.timer--;
        if (dlg.timer <= 0) {
            battleState.dialogues.splice(i, 1);
            continue;
        }
        let padding = 4;
        let h = 16;
        let w = textWidth(dlg.text) + padding * 2;
        fill(255);
        stroke(0);
        rect(dlg.x - w / 2, dlg.y - h, w, h, 4);
        noStroke();
        fill(0);
        textSize(12);
        text(dlg.text, dlg.x, dlg.y - h / 2);
    }
    fill(255);
}

function drawBattleEffects() {
     for (let i = battleState.battlefieldEffects.length - 1; i >= 0; i--) {
        let effect = battleState.battlefieldEffects[i];
        effect.duration--;
        if (effect.duration <= 0) {
            battleState.battlefieldEffects.splice(i, 1);
            continue;
        }

        let alphaValue = map(effect.duration, 0, effect.initialDuration, 50, 180);
        switch(effect.type) {
            case 'area_buff':
            case 'area_debuff':
                noFill();
                strokeWeight(2);
                stroke(red(effect.color), green(effect.color), blue(effect.color), alphaValue);
                ellipse(effect.x, effect.y, effect.radius * 2, effect.radius * 2);
                noStroke();
                break;
            case 'damage_burst': // 瞬間傷害效果，例如爆炸
                 fill(red(effect.color), green(effect.color), blue(effect.color), alphaValue * 1.5); // 更亮
                ellipse(effect.x, effect.y, effect.radius * (1 - effect.duration / effect.initialDuration) * 2); // 從小變大消失
                break;
            case 'self_buff':
                if (effect.ownerUnit && effect.ownerUnit.hp > 0) { // 僅當單位存活時繪製
                     // 在單位腳下畫一個光環
                    let auraRadius = effect.ownerUnit.size + map(sin(frameCount*0.1),-1,1,0,3); // 呼吸效果
                    let auraY = effect.ownerUnit.y + effect.ownerUnit.size / 2 + 2;
                    fill(red(effect.color), green(effect.color), blue(effect.color), alphaValue * 0.8);
                    ellipse(effect.ownerUnit.x, auraY, auraRadius, auraRadius * 0.3); // 橢圓光環
                }
                break;
            // 可以添加更多特效類型...
        }
    }
     fill(255); // Reset fill
}

function drawGameOverScreen() {
    // ... (基本不變) ...
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);
    fill(255);
    textSize(48);
    textAlign(CENTER, CENTER);
    const winner = determineWinner(); // 使用更新後的判斷
    const playerLost = factions[PLAYER_FACTION_ID].citiesCount === 0;

    if (playerLost) {
        text("遊戲結束", width / 2, height / 2 - 40);
        textSize(24);
        text("你已被擊敗...", width / 2, height / 2 + 20);
    } else if (winner) {
        text("遊戲結束", width / 2, height / 2 - 40);
        textSize(32);
        fill(winner.color);
        text(`${winner.name} 統一天下！`, width / 2, height / 2 + 20);
    }
     else {
        // 理論上不該進入此狀態除非有BUG或未定義的勝利條件
        fill(255, 0, 0);
        text("遊戲狀態異常", width / 2, height / 2);
    }

    textSize(18);
    fill(200);
    text("點擊重新開始", width / 2, height * 0.7);
}

// --- 互動處理函式 ---

function handleMapClick() {
    // ... (基本不變，注意 gameState 處理) ...
    // 檢查是否點擊了右側 UI 按鈕
    const uiX = MAP_WIDTH;
    const btnYStep = 60;
    let currentBtnY = 80;
    const btnW = UI_WIDTH - 40;
    const btnH = 40;

     // 如果不是 MAP 或 MAP_SELECT_TARGET 狀態，直接返回
    if (gameState !== 'MAP' && gameState !== 'MAP_SELECT_TARGET') return;

    // 內政按鈕
    if (mouseX > uiX + 20 && mouseX < uiX + 20 + btnW && mouseY > currentBtnY && mouseY < currentBtnY + btnH) {
        if (currentTurn === PLAYER_FACTION_ID && selectedCity && selectedCity.owner === PLAYER_FACTION_ID && gameState === 'MAP') {
            startInternalAffairs();
            return;
        } else if (currentTurn === PLAYER_FACTION_ID && gameState === 'MAP') {
            addMessage(selectedCity ? "請先選擇一個我方城市。" : "請先選擇城市再執行內政。");
        }
        return;
    }
    currentBtnY += btnYStep;

    // 戰鬥按鈕
    if (mouseX > uiX + 20 && mouseX < uiX + 20 + btnW && mouseY > currentBtnY && mouseY < currentBtnY + btnH) {
        if (currentTurn === PLAYER_FACTION_ID && selectedCity && selectedCity.owner === PLAYER_FACTION_ID && gameState === 'MAP') {
            if (selectedCity.soldiers < SOLDIERS_PER_UNIT * 5) { // 至少需要 5 個單位才能出征
                 addMessage("兵力過少，無法出征！");
                 return;
            }
            addMessage(`請選擇 ${selectedCity.name} 要攻擊的相鄰敵方或中立城市。`);
            highlightAttackableCities(selectedCity);
            gameState = 'MAP_SELECT_TARGET';
            return;
        } else if (currentTurn === PLAYER_FACTION_ID && gameState === 'MAP') {
            addMessage(selectedCity ? "請先選擇一個我方城市。" : "請先選擇城市再發動攻擊。");
        }
        return;
    }
    currentBtnY += btnYStep;

    // 回合結束按鈕
    if (mouseX > uiX + 20 && mouseX < uiX + 20 + btnW && mouseY > currentBtnY && mouseY < currentBtnY + btnH) {
        if (currentTurn === PLAYER_FACTION_ID && gameState === 'MAP') {
            endPlayerTurn();
        }
        return;
    }

    // 檢查是否點擊了地圖上的城市
    if (mouseX < MAP_WIDTH && mouseY < CANVAS_HEIGHT - MESSAGE_LOG_HEIGHT) {
        let cityClicked = null;
        for(let city of cities) {
            let d = dist(mouseX, mouseY, city.x, city.y);
            if (d < 20) { // 點擊範圍
                cityClicked = city;
                break;
            }
        }

        if (cityClicked) {
            if (gameState === 'MAP_SELECT_TARGET') {
                 // 檢查是否是有效目標 (相鄰且非我方)
                 const isAdjacent = selectedCity.adjacent.includes(cityClicked.id);
                 const isEnemyOrNeutral = cityClicked.owner !== PLAYER_FACTION_ID; // null 也是非我方

                 if (isAdjacent && isEnemyOrNeutral) {
                    targetCity = cityClicked;
                    addMessage(`選擇攻擊目標: ${targetCity.name}`);
                    clearHighlights(); // 清除高亮
                    startBattlePrep(); // 直接進入準備，不再是 MAP 狀態
                    // gameState = 'BATTLE_PREP'; // startBattlePrep 會設置
                } else if (cityClicked.id === selectedCity.id) {
                    addMessage("取消攻擊目標選擇。");
                    clearHighlights();
                    gameState = 'MAP';
                } else if (!isAdjacent) {
                     addMessage("目標城市不相鄰！");
                 } else if (!isEnemyOrNeutral){
                     addMessage("不能攻擊自己的城市！");
                } else {
                    addMessage("無效的攻擊目標！");
                }
            } else { // gameState === 'MAP'
                selectCity(cityClicked);
            }
        } else { // 點擊地圖空白處
             if (gameState === 'MAP_SELECT_TARGET') {
                addMessage("取消攻擊目標選擇。");
                clearHighlights();
                gameState = 'MAP';
             } else if (gameState === 'MAP'){
                 deselectCities();
                 clearHighlights();
             }
        }
    }
}

function handleInternalAffairsClick() {
    // ... (基本不變) ...
    // 檢查是否點擊返回按鈕
    const backButton = { x: width - 120, y: height - 60, w: 100, h: 40 };
    if (mouseX > backButton.x && mouseX < backButton.x + backButton.w &&
        mouseY > backButton.y && mouseY < backButton.y + backButton.h) {
        gameState = 'MAP';
        addMessage("返回地圖。");
        return;
    }

    // 檢查是否點擊了卡片
    const cardWidth = 150;
    const cardHeight = 200;
    const startX = (width - (internalAffairsCards.length * cardWidth + (internalAffairsCards.length - 1) * 20)) / 2;
    const startY = 150;

    internalAffairsCards.forEach((card, index) => {
        const cardX = startX + index * (cardWidth + 20);
        if (mouseX > cardX && mouseX < cardX + cardWidth &&
            mouseY > startY && mouseY < startY + cardHeight) {
            applyInternalAffairsCard(card);
            // gameState = 'MAP'; // applyInternalAffairsCard 會處理
            return;
        }
    });
}

function handleBattlePrepClick() {
    // ... (基本不變) ...
    const btnW = 150;
    const btnH = 50;
    const boxY = 150;
    const boxHeight = 250;
    const btnY = boxY + boxHeight + 50;
    const startBtnX = width / 2 - btnW - 20;
    const cancelBtnX = width / 2 + 20;

    // 開始戰鬥按鈕
    if (mouseX > startBtnX && mouseX < startBtnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
        startBattle(); // 會切換 gameState 到 BATTLE
    }

    // 取消按鈕
    if (mouseX > cancelBtnX && mouseX < cancelBtnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
        addMessage("取消戰鬥。");
        gameState = 'MAP';
        clearHighlights();
        selectedCity = null; // 取消選擇，避免誤操作
        targetCity = null;
    }
}

function handleBattleClick() {
     if (battleState.battlePhase === 'END') {
        endBattle(); // 會處理 gameState 切換和後續檢查
        return;
    }
     if (battleState.battlePhase !== 'FIGHTING') return; // 部署階段不能點

    const isPlayerAttacker = battleState.attacker?.factionId === PLAYER_FACTION_ID;
    const isPlayerDefender = battleState.defender?.factionId === PLAYER_FACTION_ID;

    if (isPlayerAttacker || isPlayerDefender) {
        // --- 點擊指令按鈕 ---
        const cmdBtnY = BATTLE_AREA_HEIGHT - 130;
        const cmdBtnX = isPlayerAttacker ? 50 : width - 150 - 20;
        const btnW = 80;
        const btnH = 30;
        const btnSpacing = 10;
        const commands = [
            { command: "charge" }, { command: "defend" }, { command: "standard" } // 與 drawBattleCommands 對應
        ];

        for (let i = 0; i < commands.length; i++) {
             let currentBtnY = cmdBtnY + i * (btnH + btnSpacing);
             if (mouseX > cmdBtnX && mouseX < cmdBtnX + btnW && mouseY > currentBtnY && mouseY < currentBtnY + btnH) {
                const cmd = commands[i].command;
                 if (battleState.playerCommand !== cmd) {
                    battleState.playerCommand = cmd;
                    addMessage(`下令: ${cmd.charAt(0).toUpperCase() + cmd.slice(1)}!`);
                    // 可以在這裡立即應用某些指令效果，或讓 updateBattle 處理
                 }
                return; // 點擊了一個按鈕，結束處理
            }
        }


        // --- 點擊武將技能按鈕 ---
        // --- 點擊武將技能按鈕 (修改) ---
        const uiY = BATTLE_AREA_HEIGHT - 60;
        const generalSpacing = 120;
        const generalIconSize = 30;
        const skillButtonH = 20;
        const skillButtonW = 55;
        const skillButtonSpacing = 5;

        const playerGenerals = isPlayerAttacker ? battleState.attacker.generals : battleState.defender.generals;
        const playerSideStartX = isPlayerAttacker ? 60 : width - 60;
        const playerSideDirection = isPlayerAttacker ? 1 : -1;

        if (playerGenerals) {
            playerGenerals.forEach((gen, i) => {
                const genX = playerSideStartX + i * generalSpacing * playerSideDirection;
                const genY = uiY;

                if (gen.skills && gen.skills.length > 0) {
                    const totalButtonWidth = gen.skills.length * skillButtonW + (gen.skills.length - 1) * skillButtonSpacing;
                    const firstButtonX = genX - totalButtonWidth / 2;

                    gen.skills.forEach((skill, skillIndex) => {
                        const skillBtnX = firstButtonX + skillIndex * (skillButtonW + skillButtonSpacing);
                        const skillBtnY = genY + generalIconSize / 2 + 30;
                        const canUseSkill = skill.cooldown === 0;
                        const skillKey = gen.id + '_' + skillIndex;
                        const isActive = battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] < skill.duration;

                        if (canUseSkill &&
                            mouseX > skillBtnX && mouseX < skillBtnX + skillButtonW &&
                            mouseY > skillBtnY && mouseY < skillBtnY + skillButtonH) {
                            if (!isActive) { // 只有非持續狀態下才能再次發動
                                activateGeneralSkill(gen, isPlayerAttacker, skillIndex); // *** 傳入 skillIndex ***
                                addMessage(`${gen.name} 發動技能 [${skill.name}]!`);
                                showDialogueForGeneral(gen, isPlayerAttacker, `施展 ${skill.name}`);
                            } else {
                                addMessage(`技能 [${skill.name}] 效果持續中...`);
                            }
                            return; // 點擊了一個技能，處理完畢
                        }
                    });
                }
            });
        }
    }
}

function handleGameOverClick() {
    resetGame(); // 點擊直接重置
}

// --- 遊戲邏輯函式 ---

function addMessage(msg) {
    let timeStr = `[${gameYear}年${gameMonth}月]`;
    let fullMsg = `${timeStr} ${msg}`;
    messageLog.push(fullMsg);
    if (messageLog.length > 100) { // 增加訊息記錄上限
        messageLog.shift();
    }
    console.log(fullMsg); // 同時輸出到控制台方便除錯
}

function selectCity(city) {
    deselectCities();
    city.isSelected = true;
    selectedCity = city;
    if (city.owner === PLAYER_FACTION_ID) {
        addMessage(`選擇了我方城市: ${city.name}`);
    } else {
        const ownerFaction = findFactionById(city.owner);
        addMessage(`查看城市: ${city.name} (屬於 ${ownerFaction ? ownerFaction.name : '中立'})`);
    }
    clearHighlights(); // 選擇新城市時清除目標高亮
    if (gameState === 'MAP_SELECT_TARGET') gameState = 'MAP'; // 如果在選目標時點了別的，退回 MAP 狀態
}

function deselectCities() {
    cities.forEach(c => c.isSelected = false);
    selectedCity = null;
}

function highlightAttackableCities(sourceCity) {
    clearHighlights();
    sourceCity.adjacent.forEach(adjId => {
        const adjCity = findCityById(adjId);
        // 可以攻擊非我方的相鄰城市
        if (adjCity && adjCity.owner !== sourceCity.owner) {
            adjCity.isTargeted = true;
        }
    });
}

function clearHighlights() {
    cities.forEach(c => c.isTargeted = false);
}

function startInternalAffairs() {
    if (!selectedCity || selectedCity.owner !== PLAYER_FACTION_ID || gameState !== 'MAP') return;

    internalAffairsCards = [];
    const cardPool = [
        // 調整數值和效果
        { type: 'recruit', title: "招募士兵", description: `增加 ${Math.floor(selectedCity.defense * 30 + 1500)} 士兵`, effect: { soldiers: Math.floor(selectedCity.defense * 30 + 1500) }, costFood: 1000, costGold: 50 }, // 費用和效果調整
        { type: 'develop', title: "開墾農田", description: "增加 5000 糧草", effect: { food: 5000 }, costFood: 0, costGold: 30 },
        { type: 'reinforce', title: "加固城防", description: "增加 10 城防值", effect: { defense: 10 }, costFood: 2000, costGold: 100 },
        { type: 'trade', title: "市場貿易", description: "獲得 200 金錢", effect: { gold: 200 }, costFood: 1000 }, // 新增金錢概念 (雖然還沒實作金錢系統)
        { type: 'levy', title: "徵收糧草", description: "獲得 3000 糧草\n(可能降民忠)", effect: { food: 3000 }, costFood: 0, costGold: -20 }, // 負金錢表示增加
    ];

    let availableCards = [...cardPool];
    for (let i = 0; i < 4 && availableCards.length > 0; i++) {
        let randomIndex = floor(random(availableCards.length));
        internalAffairsCards.push(availableCards[randomIndex]);
        availableCards.splice(randomIndex, 1);
    }

    gameState = 'INTERNAL_AFFAIRS';
    addMessage(`為 ${selectedCity.name} 選擇內政指令...`);
}

function applyInternalAffairsCard(card) {
    if (!selectedCity || gameState !== 'INTERNAL_AFFAIRS') return;

    // 檢查資源 (假設有金錢 costGold)
    let foodCost = card.costFood || 0;
    // let goldCost = card.costGold || 0; // 待金錢系統實作

    if (selectedCity.food < foodCost) {
        addMessage(`糧草不足 (${selectedCity.food}/${foodCost})，無法執行 [${card.title}]。`);
        gameState = 'MAP'; // 返回地圖
        return;
    }
    // if (selectedCity.gold < goldCost) { // 待金錢系統實作
    //     addMessage(`金錢不足...`);
    //     return;
    // }

    selectedCity.food -= foodCost;
    // selectedCity.gold -= goldCost;

    // 應用效果
    if (card.effect.soldiers) selectedCity.soldiers += card.effect.soldiers;
    if (card.effect.food) selectedCity.food += card.effect.food;
    if (card.effect.defense) selectedCity.defense = min(100, selectedCity.defense + card.effect.defense); // 防禦上限 100
    // if (card.effect.gold) selectedCity.gold += card.effect.gold;

    addMessage(`在 ${selectedCity.name} 執行了 [${card.title}]。`);
    gameState = 'MAP'; // 執行完畢返回地圖
    // 執行完內政通常直接結束回合
    // endPlayerTurn(); // 取決於設計，這裡先不自動結束
}

function startBattlePrep() {
    if (!selectedCity || !targetCity || gameState !== 'MAP_SELECT_TARGET') return;

    const attackerFaction = findFactionById(selectedCity.owner);
    const defenderFaction = findFactionById(targetCity.owner);

    // 決定出征兵力 (例如最多 80%，或由玩家選擇 - 簡化為 80%)
    let attackerSoldiersToDeploy = floor(selectedCity.soldiers * 0.8);
    if (attackerSoldiersToDeploy < SOLDIERS_PER_UNIT) {
         addMessage("兵力不足，無法發起進攻！");
         gameState = 'MAP';
         clearHighlights();
         deselectCities();
         return;
    }

     // 確保攻守方都有武將列表，即使是空的
    selectedCity.generals = selectedCity.generals || [];
    targetCity.generals = targetCity.generals || [];
    const attackerGenerals = selectedCity.generals.slice(0, MAX_GENERALS_PER_BATTLE);
    const defenderGenerals = targetCity.generals.slice(0, MAX_GENERALS_PER_BATTLE);


    battleState = {
        attacker: {
            factionId: selectedCity.owner,
            cityId: selectedCity.id,
            soldiers: attackerSoldiersToDeploy, // 只帶部分兵力
            initialSoldiers: attackerSoldiersToDeploy,
            generals: attackerGenerals.map(g => ({...g})), // 取前幾位武將
            color: attackerFaction.color, // 儲存顏色方便使用
            unitComposition: selectedCity.unitComposition || { SPEARMAN: 0.25, SHIELDMAN: 0.25, CAVALRY: 0.25, ARCHER: 0.25 }, // 默認平均分配
            initialUnits: floor(attackerSoldiersToDeploy / SOLDIERS_PER_UNIT), // 初始單位數
        },
        defender: {
            factionId: targetCity.owner,
            cityId: targetCity.id,
            soldiers: targetCity.soldiers, // 守方全軍出擊
            initialSoldiers: targetCity.soldiers,
            generals: defenderGenerals.map(g => ({...g})),
            color: defenderFaction ? defenderFaction.color : color(128), // 中立灰色
             unitComposition: targetCity.unitComposition || { SPEARMAN: 0.25, SHIELDMAN: 0.25, CAVALRY: 0.25, ARCHER: 0.25 },
             initialUnits: floor(targetCity.soldiers / SOLDIERS_PER_UNIT), // 初始單位數
             cityDefenseBonus: targetCity.defense, // 把城防值傳入
        },
        attackerUnits: [],
        defenderUnits: [],
        battlePhase: 'DEPLOY',
        battleTimer: 0,
        battleWinner: null,
        playerCommand: 'standard', // 預設指令
        damageTexts: [],
        battlefieldEffects: [],
         lastGeneralSkillTime: {}, // 重置技能計時器
        projectiles: [],
        dialogues: []
    };

    // 扣除出征兵力
    selectedCity.soldiers -= attackerSoldiersToDeploy;

    addMessage(`準備從 ${selectedCity.name} 出兵 ${attackerSoldiersToDeploy} 攻擊 ${targetCity.name}...`);
    gameState = 'BATTLE_PREP';
}

// ==================================
// ===== BATTLE START (REVISED) =====
// ==================================
function startBattle() {
    if (!battleState.attacker || battleState.battlePhase !== 'DEPLOY') return;

    addMessage("戰鬥開始！部署部隊...");
    battleState.battlePhase = 'FIGHTING';
    battleState.battleTimer = 0;
    battleState.damageTexts = []; // 清空上次戰鬥的傷害數字
     battleState.battlefieldEffects = []; // 清空特效
     battleState.lastGeneralSkillTime = {};
        battleState.projectiles = []; // <--- 新增：清空箭矢
    battleState.dialogues = []; // 清空對話

    assignGeneralTargets();


    const attackerUnitCount = battleState.attacker.initialUnits;
    const defenderUnitCount = battleState.defender.initialUnits;

    // --- 部署攻擊方單位 ---
    battleState.attackerUnits = [];
    let attackerComposition = battleState.attacker.unitComposition;
    let attackerCurrentUnits = 0;
    // 按兵種比例生成單位
    for (const typeName in attackerComposition) {
        const typeData = UnitTypes[typeName];
        const count = floor(attackerUnitCount * attackerComposition[typeName]);
        for (let i = 0; i < count && attackerCurrentUnits < attackerUnitCount; i++) {
            let unit = createUnit(typeName, battleState.attacker.factionId, true);
            positionUnit(unit, attackerCurrentUnits, attackerUnitCount, true); // 定位單位
            battleState.attackerUnits.push(unit);
            attackerCurrentUnits++;
        }
    }
     // 如果因取整導致單位不足，用預設兵種補齊 (例如槍兵)
    while(attackerCurrentUnits < attackerUnitCount) {
        let unit = createUnit('SPEARMAN', battleState.attacker.factionId, true);
        positionUnit(unit, attackerCurrentUnits, attackerUnitCount, true);
        battleState.attackerUnits.push(unit);
        attackerCurrentUnits++;
    }


    // --- 部署防守方單位 ---
    battleState.defenderUnits = [];
    let defenderComposition = battleState.defender.unitComposition;
    let defenderCurrentUnits = 0;
    for (const typeName in defenderComposition) {
        const typeData = UnitTypes[typeName];
        const count = floor(defenderUnitCount * defenderComposition[typeName]);
        for (let i = 0; i < count && defenderCurrentUnits < defenderUnitCount; i++) {
            let unit = createUnit(typeName, battleState.defender.factionId, false);
            positionUnit(unit, defenderCurrentUnits, defenderUnitCount, false);
            battleState.defenderUnits.push(unit);
            defenderCurrentUnits++;
        }
    }
     while(defenderCurrentUnits < defenderUnitCount) {
        let unit = createUnit('SHIELDMAN', battleState.defender.factionId, false); // 守方預設盾兵
        positionUnit(unit, defenderCurrentUnits, defenderUnitCount, false);
        battleState.defenderUnits.push(unit);
        defenderCurrentUnits++;
    }


    // 重置武將冷卻 (如果需要每次戰鬥都重置的話)
    // battleState.attacker.generals.forEach(g => g.skillCooldown = 0);
    // battleState.defender.generals.forEach(g => g.skillCooldown = 0);

     console.log(`Battle started: ${attackerUnitCount} attacker units vs ${defenderUnitCount} defender units.`);
    gameState = 'BATTLE'; // 切換到戰鬥狀態
}

// --- 新增：單位創建與定位輔助函式 ---
function createUnit(typeName, factionId, isAttacker) {
    const typeData = UnitTypes[typeName];
    if (!typeData) {
        console.error(`Unknown unit type: ${typeName}. Defaulting to Spearman.`);
        typeName = 'SPEARMAN';
        typeData = UnitTypes[typeName];
    }
     // 查找勢力顏色
    const faction = findFactionById(factionId);
    const unitColor = faction ? faction.color : color(128); // 若找不到勢力則為灰色

    return new Unit(
        0, 0, // Initial position, will be set by positionUnit
        factionId,
        unitColor,
        typeName,
        typeData.hp,
        typeData.attack,
        typeData.defense,
        typeData.speed,
        typeData.range,
        isAttacker,
        typeData.shape,
         UNIT_VISUAL_SIZE,
         SOLDIERS_PER_UNIT,
         // 將特性也傳入
         {
             vsCavalryBonus: typeData.vsCavalryBonus,
             vsArcherResist: typeData.vsArcherResist,
             chargeBonus: typeData.chargeBonus,
             chargeCooldown: typeData.chargeCooldown,
             stationaryAttackBonus: typeData.stationaryAttackBonus,
         }
    );
}

function positionUnit(unit, index, totalUnits, isAttacker) {
    const unitsPerRow = 20; // 每行多少單位
    const rowSpacing = UNIT_VISUAL_SIZE * 1.8; // 行間距
    const colSpacing = UNIT_VISUAL_SIZE * 1.5; // 列間距
    const deploymentAreaWidth = unitsPerRow * colSpacing;
    const startY = 50; // 頂部部署起始 Y

    let row = floor(index / unitsPerRow);
    let col = index % unitsPerRow;

    let xOffset = (width / 2 - deploymentAreaWidth) / 2; // 讓部署區域稍微居中於半場

    if (isAttacker) {
        // 攻擊方部署在左側
        unit.x = xOffset + col * colSpacing + random(-colSpacing/4, colSpacing/4); // 加入隨機偏移避免完全對齊
        unit.y = startY + row * rowSpacing + random(-rowSpacing/4, rowSpacing/4);
        // 根據兵種稍微調整初始位置 (例如弓兵靠後)
        if (unit.type === 'ARCHER') unit.y += rowSpacing; // 弓兵往後一排
        if (unit.type === 'CAVALRY') unit.x -= colSpacing; // 騎兵稍微靠前或側面
        if (unit.type === 'SHIELDMAN') unit.y -= rowSpacing * 0.5; // 盾兵靠前一點

    } else {
        // 防守方部署在右側
        unit.x = width - (xOffset + col * colSpacing) + random(-colSpacing/4, colSpacing/4);
        unit.y = startY + row * rowSpacing + random(-rowSpacing/4, rowSpacing/4);
        if (unit.type === 'ARCHER') unit.y += rowSpacing;
        if (unit.type === 'CAVALRY') unit.x += colSpacing;
        if (unit.type === 'SHIELDMAN') unit.y -= rowSpacing * 0.5;
    }
     // 確保單位在戰場內
     unit.x = constrain(unit.x, unit.size / 2, width - unit.size / 2);
     unit.y = constrain(unit.y, unit.size / 2 + barY + barHeight, BATTLE_AREA_HEIGHT - 80); 
  // 避開頂部UI和底部武將區
}


// ===================================
// ===== BATTLE UPDATE (REVISED) =====
// ===================================
function updateBattle() {
    if (battleState.battlePhase !== 'FIGHTING') return;

    battleState.battleTimer++;

    // --- AI 控制武將技能 (簡化) ---
    // 讓 AI 在冷卻結束後有一定機率使用技能
    const aiGenerals = [];
     if(battleState.attacker && !findFactionById(battleState.attacker.factionId)?.isAI && battleState.defender && findFactionById(battleState.defender.factionId)?.isAI) {
        aiGenerals.push(...battleState.defender.generals.map(g => ({general: g, isAttacker: false})));
    }
    if(battleState.defender && !findFactionById(battleState.defender.factionId)?.isAI && battleState.attacker && findFactionById(battleState.attacker.factionId)?.isAI) {
        aiGenerals.push(...battleState.attacker.generals.map(g => ({general: g, isAttacker: true})));
    }
    // 如果雙方都是 AI
     if(battleState.attacker && findFactionById(battleState.attacker.factionId)?.isAI && battleState.defender && findFactionById(battleState.defender.factionId)?.isAI) {
         aiGenerals.push(...battleState.attacker.generals.map(g => ({general: g, isAttacker: true})));
         aiGenerals.push(...battleState.defender.generals.map(g => ({general: g, isAttacker: false})));
     }


    if (battleState.battleTimer % 60 === 0) {
         aiGenerals.forEach(({general, isAttacker}) => {
             // *** 遍歷 AI 武將的技能 ***
             if (general.skills && general.skills.length > 0) {
                 for (let skillIndex = 0; skillIndex < general.skills.length; skillIndex++) {
                     const skill = general.skills[skillIndex];
                     const skillKey = general.id + '_' + skillIndex;
                     if (skill.cooldown === 0) { // 技能可用
                          // 檢查是否持續中
                         if (!(battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] < skill.duration && skill.duration > 1)) {
                              // *** AI 使用第一個可用的技能 ***
                              if (random() < 0.4) { // 40% 機率使用第一個可用的技能
                                 activateGeneralSkill(general, isAttacker, skillIndex);
                                 addMessage(`[AI] ${general.name} 發動技能 [${skill.name}]!`);
                                 showDialogueForGeneral(general, isAttacker, `施展 ${skill.name}`);
                                 break; // 使用了一個技能就跳出內層循環，不再檢查該武將的其他技能
                              }
                         }
                     }
                 } // end skill loop
             }
        });
    }


    // --- 更新所有單位狀態 ---
    const allUnits = [...battleState.attackerUnits, ...battleState.defenderUnits];
    const attackerUnits = battleState.attackerUnits;
    const defenderUnits = battleState.defenderUnits;

    // 1. 更新單位 Buff/Debuff 持續時間和效果
    allUnits.forEach(unit => unit.updateEffects());

    // 2. 單位行為決策 (尋找目標、移動、攻擊)
    attackerUnits.forEach(unit => {
        if (unit.hp > 0) {
            unit.update(defenderUnits, attackerUnits); // 傳入敵方和友方列表
        }
    });
    defenderUnits.forEach(unit => {
        if (unit.hp > 0) {
            unit.update(attackerUnits, defenderUnits);
        }
    });

// --- 移除死亡單位 ---
    // 使用 filter 創建新陣列，先保留 dying 狀態用於動畫
    let currentAttackerUnits = battleState.attackerUnits.filter(unit => unit.hp > 0 || unit.state === 'dying');
    let currentDefenderUnits = battleState.defenderUnits.filter(unit => unit.hp > 0 || unit.state === 'dying');

    // 更新 battleState，但這次只移除 state 為 'dead' 的單位 (動畫已結束)
    battleState.attackerUnits = currentAttackerUnits.filter(unit => unit.state !== 'dead');
    battleState.defenderUnits = currentDefenderUnits.filter(unit => unit.state !== 'dead');


    // --- 檢查戰鬥結束條件 (修正後) ---
    if (battleState.battlePhase === 'FIGHTING') { // 確保只在戰鬥階段檢查
        // 檢查是否有一方**沒有任何存活單位** (hp > 0)
        const attackersAlive = battleState.attackerUnits.some(unit => unit.hp > 0);
        const defendersAlive = battleState.defenderUnits.some(unit => unit.hp > 0);

        if (!attackersAlive || !defendersAlive) {
            battleState.battlePhase = 'END'; // 設置階段為結束

            // 判斷勝利者
            if (!defendersAlive && attackersAlive) {
                // 守方全滅，攻方存活 -> 攻方勝
                battleState.battleWinner = battleState.attacker.factionId;
            } else if (!attackersAlive && defendersAlive) {
                // 攻方全滅，守方存活 -> 守方勝
                battleState.battleWinner = battleState.defender.factionId;
            } else {
                // 雙方同時全滅 (極少情況，或其中一方只剩 dying 單位)
                // 判定守方勝利（通常守方有優勢，或避免無法結束戰鬥）
                battleState.battleWinner = battleState.defender.factionId;
                 addMessage("雙方主力同時潰滅，守方慘勝！"); // 可以添加特定提示
                 console.log("Battle ended - Mutual destruction, defender wins.");
                 // 或者判定為平局？ battleState.battleWinner = null; 但需要處理平局邏輯
            }

            if (battleState.battleWinner !== null) { // 確保判定了勝者
                 const winnerFaction = findFactionById(battleState.battleWinner);
                 addMessage(`戰鬥結束！${winnerFaction ? winnerFaction.name : '一方'} 勝利！`);
                 console.log("Battle ended. Winner Faction ID:", battleState.battleWinner);
            } else if (!attackersAlive && !defendersAlive) {
                 // 如果上面判定平局，可以在這裡處理
                 addMessage("戰鬥結束！雙方同歸於盡！");
                 console.log("Battle ended - Draw (Mutual destruction)");
                 // 可能需要特殊處理平局後的城市歸屬等
            }
        }
    }

// --- 更新飛行物 (箭矢等) ---
    for (let i = battleState.projectiles.length - 1; i >= 0; i--) {
        let p = battleState.projectiles[i];
        p.update(); // 更新箭矢位置和狀態

        // 移除已經擊中或飛出屏幕的箭矢
        if (p.hit || p.isOffScreen()) {
            battleState.projectiles.splice(i, 1);
        }
    }


    // --- 更新武將技能冷卻 ---
     const allGenerals = [...(battleState.attacker?.generals || []), ...(battleState.defender?.generals || [])];
     allGenerals.forEach(gen => {
         if (gen.skills && gen.skills.length > 0) { // *** 檢查是否有 skills 陣列 ***
             gen.skills.forEach((skill, skillIndex) => { // *** 遍歷技能 ***
                 if (skill.cooldown > 0) {
                     skill.cooldown--; // *** 減少對應技能的冷卻 ***
                 }
                 // 如果技能效果結束，清除計時器
                 const skillKey = gen.id + '_' + skillIndex; // *** 使用唯一鍵 ***
                 if (battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] >= skill.duration) {
                    delete battleState.lastGeneralSkillTime[skillKey];
                    removeGeneralEffect(gen, skill); // *** 傳遞技能信息以移除效果 ***
                 }
             });
         }
     });

    // --- 清理過期的特效 ---
     // (已在 drawBattleEffects 中處理，或在 Unit.updateEffects 中處理)

}

// 新增：移除武將技能效果的函數
function removeGeneralEffect(general, skill) { // *** 添加 skill 參數 ***
    if (!skill) return; // 如果沒有傳入技能信息，則無法移除

    const targetUnits = (battleState.attacker?.generals.includes(general)) ? battleState.attackerUnits : battleState.defenderUnits;
    const friendlyUnits = targetUnits;
    const enemyUnits = (targetUnits === battleState.attackerUnits) ? battleState.defenderUnits : battleState.attackerUnits;

    // 移除 battlefieldEffects 中與此技能相關的視覺效果
     battleState.battlefieldEffects = battleState.battlefieldEffects.filter(effect => {
         return !(effect.skillName === skill.name); // 移除同名技能視覺
     });

     // 移除單位身上的 Buff/Debuff
     let unitsToClean = [];
     switch(skill.type) { // *** 根據傳入的技能類型判斷 ***
         case 'buff_area':
         case 'buff_area_def':
         case 'heal_area': // 治療光環也應移除
         case 'charge_attack': // 衝鋒buff
         case 'damage_reflect':
              unitsToClean = friendlyUnits;
             break;
         case 'debuff_area':
         case 'debuff_area_def':
             unitsToClean = enemyUnits;
             break;
          case 'self_buff': // 自身buff影響友軍的範圍效果也需清理
               unitsToClean = friendlyUnits;
              break;
     }
     // 移除與此技能名稱相關的所有效果
     unitsToClean.forEach(unit => unit.removeEffect(skill.name));
     // 如果技能會產生多個效果名（如 self_buff），需要單獨處理
     if (skill.type === 'self_buff') {
         unitsToClean.forEach(unit => {
             unit.removeEffect(skill.name + '_atk');
             unit.removeEffect(skill.name + '_def');
         });
     }
       if (skill.type === 'charge_attack') {
         unitsToClean.forEach(unit => {
             unit.removeEffect(skill.name + '_spd');
             unit.removeEffect(skill.name + '_atk');
         });
     }
}


// ========================================
// ===== ACTIVATE GENERAL SKILL (REVISED) =====
// ========================================
function activateGeneralSkill(general, isAttackerSide, skillIndex) { // *** 添加 skillIndex ***
    if (!general.skills || !general.skills[skillIndex]) {
        console.error(`General ${general.name} does not have skill at index ${skillIndex}`);
        return;
    }

    const skill = general.skills[skillIndex]; // *** 獲取指定技能 ***
    const skillKey = general.id + '_' + skillIndex; // *** 用於計時器的唯一鍵 ***

    if (skill.cooldown > 0) {
        addMessage(`技能 [${skill.name}] 冷卻中...`);
        return;
    }
    // 持續性技能檢查
    if (battleState.lastGeneralSkillTime[skillKey] && frameCount - battleState.lastGeneralSkillTime[skillKey] < skill.duration && skill.duration > 1) { // 持續時間大於1幀才算持續性
        addMessage(`技能 [${skill.name}] 效果持續中...`);
        return;
    }

    const friendlyUnits = isAttackerSide ? battleState.attackerUnits : battleState.defenderUnits;
    const enemyUnits = isAttackerSide ? battleState.defenderUnits : battleState.attackerUnits;
    let skillEffectApplied = false;

    // 施法中心點（可以根據技能類型調整，例如箭雨可能以鼠標位置為目標）
    // 簡化： AOE 技能中心點大致在戰線附近
    let skillCenterX = width / 2 + (isAttackerSide ? -width/6 : width/6) + random(-50, 50);
    let skillCenterY = BATTLE_AREA_HEIGHT / 2 + random(-50, 50);

    console.log(`Activating skill: ${general.name} - ${skill.name} (Index: ${skillIndex}), Type: ${skill.type}`);

    // 記錄技能施放時間 (即使是非持續性技能也記錄一下，方便追蹤)
    battleState.lastGeneralSkillTime[skillKey] = frameCount;
    skill.cooldown = skill.maxCooldown; // *** 設置對應技能的冷卻 ***
    showDialogueForGeneral(general, isAttackerSide, `施展 ${skill.name}`);

    switch (skill.type) {
        case 'aoe_damage':
            let affectedCount = 0;
            enemyUnits.forEach(unit => {
                let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                if (d < skill.range) {
                    let damage = floor(skill.value * (general.leadership / 50) * (1 + random(-0.1, 0.1)));
                    damage = max(1, damage);
                    unit.takeDamage(damage, 'skill');
                    createDamageText(unit.x, unit.y, damage, color(255, 100, 0));
                    affectedCount++;
                }
            });
            createBattlefieldEffect('damage_burst', skillCenterX, skillCenterY, skill.range, 30, color(255, 80, 0), null, skill.name);
            addMessage(`[${skill.name}] 對 ${affectedCount} 個敵方單位造成了範圍傷害！`);
            skillEffectApplied = true;
            break;

        // --- 新增：箭雨邏輯 ---
        case 'aoe_damage_arrows':
            const numArrows = skill.value; // 箭的數量
            const arrowDamage = 25; // 每支箭的傷害 (可以設為技能屬性)
            const arrowSpeed = 7;
            addMessage(`[${skill.name}] 發動！大量箭矢落下！`);
			
			let targetSideX;
            if (isAttackerSide) {
                // 攻擊方施法，目標在右側 (防守方區域)
                targetSideX = width * 0.75; // 大約在右側 3/4 處
            } else {
                // 防守方施法，目標在左側 (攻擊方區域)
                targetSideX = width * 0.25; // 大約在左側 1/4 處
            }
            let targetCenterY = BATTLE_AREA_HEIGHT / 2; // Y 軸先大致居中

            // 在目標區域生成多支箭矢從天而降
            for (let i = 0; i < numArrows; i++) {
                let rainStartX = targetSideX + random(-skill.range, skill.range);
                let rainStartY = 0 + random(-20, 0); // 從屏幕頂部稍上方開始
                let rainTargetX = skillCenterX + random(-skill.range * 0.8, skill.range * 0.8); // 落點更集中
                let rainTargetY = BATTLE_AREA_HEIGHT - random(20, 60); // 落在地面附近

                let arrow = new Arrow(rainStartX, rainStartY, rainTargetX, rainTargetY, arrowSpeed, arrowDamage, general.factionId, color(150, 150, 0)); // 黃綠色箭矢
                battleState.projectiles.push(arrow);
            }
            // 創建地面目標區域視覺效果
             createBattlefieldEffect('area_debuff', skillCenterX, skillCenterY, skill.range, 60, color(100, 100, 50, 100), null, skill.name); // 短暫顯示目標圈
            skillEffectApplied = true;
            break;

        case 'debuff_area': // 降攻
        case 'debuff_area_def': // *** 新增：降防 ***
            let debuffedCount = 0;
            let effectType = (skill.type === 'debuff_area_def') ? 'defense_multiplier' : 'attack_multiplier';
            let effectColor = (skill.type === 'debuff_area_def') ? color(80, 150, 200) : color(150, 50, 200); // 降防用藍色系
            enemyUnits.forEach(unit => {
                let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                if (d < skill.range) {
                    unit.applyEffect(skill.name, effectType, skill.value, skill.duration);
                    debuffedCount++;
                }
            });
            createBattlefieldEffect('area_debuff', skillCenterX, skillCenterY, skill.range, skill.duration, effectColor, null, skill.name);
            addMessage(`[${skill.name}] 影響了 ${debuffedCount} 個敵方單位！`);
            skillEffectApplied = true;
            break;

        case 'self_buff': // 強化自身 (影響周圍友軍)
            let selfBuffedCount = 0;
            friendlyUnits.forEach(unit => {
                let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                if (d < (skill.range || 80)) {
                    unit.applyEffect(skill.name + '_atk', 'attack_multiplier', skill.value, skill.duration);
                    unit.applyEffect(skill.name + '_def', 'defense_multiplier', skill.value, skill.duration);
                    selfBuffedCount++;
                }
            });
            createBattlefieldEffect('area_buff', skillCenterX, skillCenterY, (skill.range || 80), skill.duration, color(255, 215, 0, 100), null, skill.name);
            addMessage(`[${skill.name}] 強化了 ${selfBuffedCount} 個友方單位！`);
            skillEffectApplied = true;
            break;

        case 'buff_area': // 提升友軍攻擊
        case 'buff_area_def': // *** 新增：提升友軍防禦 ***
            let areaBuffedCount = 0;
             let buffType = (skill.type === 'buff_area_def') ? 'defense_multiplier' : 'attack_multiplier';
             let buffColor = (skill.type === 'buff_area_def') ? color(80, 80, 255, 100) : color(255, 80, 80, 100);
             let buffText = (skill.type === 'buff_area_def') ? '防禦力' : '攻擊力';
            friendlyUnits.forEach(unit => {
                let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                if (d < skill.range) {
                    unit.applyEffect(skill.name, buffType, skill.value, skill.duration);
                    areaBuffedCount++;
                }
            });
            createBattlefieldEffect('area_buff', skillCenterX, skillCenterY, skill.range, skill.duration, buffColor, null, skill.name);
            addMessage(`[${skill.name}] 提升了 ${areaBuffedCount} 個友方單位的${buffText}！`);
            skillEffectApplied = true;
            break;

         // --- 新增：單體傷害 ---
         case 'single_damage':
             let closestTarget = null;
             let minDist = skill.range; // 只在技能範圍內找
             enemyUnits.forEach(unit => {
                 let d = dist(skillCenterX, skillCenterY, unit.x, unit.y); // 以技能中心點為準
                 if (unit.hp > 0 && d < minDist) {
                     minDist = d;
                     closestTarget = unit;
                 }
             });
             if (closestTarget) {
                 let damage = floor(skill.value * (general.attack / 80) * random(0.9, 1.1)); // 受武將攻擊力影響
                 damage = max(1, damage);
                 closestTarget.takeDamage(damage, 'skill');
                 createDamageText(closestTarget.x, closestTarget.y, damage, color(255, 50, 50)); // 高亮紅色
                  // 創建一個指向目標的特效
                  createBattlefieldEffect('attack_line', skillCenterX, skillCenterY, closestTarget.x, closestTarget.y, 15, color(255,0,0), null, skill.name);
                  addMessage(`[${skill.name}] 對 ${closestTarget.type} 造成 ${damage} 點傷害！`);
                 skillEffectApplied = true;
             } else {
                  addMessage(`[${skill.name}] 未找到範圍內的目標！`);
                 skillEffectApplied = false; // 技能失敗
             }
             break;

         // --- 新增：治療 ---
         case 'heal_area':
             let healedCount = 0;
             friendlyUnits.forEach(unit => {
                 let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                 if (unit.hp > 0 && unit.hp < unit.maxHp && d < skill.range) {
                     unit.hp += skill.value;
                     unit.hp = min(unit.hp, unit.maxHp); // 不超過最大HP
                     createDamageText(unit.x, unit.y, `+${skill.value}`, color(0, 255, 100)); // 治療用綠色
                     healedCount++;
                 }
             });
             createBattlefieldEffect('area_buff', skillCenterX, skillCenterY, skill.range, 60, color(100, 255, 100, 100), null, skill.name); // 綠色光環
              addMessage(`[${skill.name}] 治療了 ${healedCount} 個友方單位！`);
             skillEffectApplied = true;
             break;

          // --- 新增：衝鋒強化 (示例) ---
          case 'charge_attack':
              // 通常這類技能是 buff 自身或友軍騎兵的衝鋒效果
              // 這裡簡化為給範圍內友軍施加一個臨時的衝鋒效果或速度提升
              let chargeBuffedCount = 0;
               friendlyUnits.forEach(unit => {
                   let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                   if (d < skill.range) {
                       // 效果1: 短時間提升速度
                       unit.applyEffect(skill.name + '_spd', 'speed_multiplier', 1.5, skill.duration);
                       // 效果2: 提升下次攻擊的衝鋒傷害 (如果可以實現) - 較複雜
                       // 簡化: 直接提升攻擊力
                       unit.applyEffect(skill.name + '_atk', 'attack_multiplier', skill.value, skill.duration);
                       chargeBuffedCount++;
                   }
               });
               createBattlefieldEffect('area_buff', skillCenterX, skillCenterY, skill.range, skill.duration, color(255, 150, 50, 100), null, skill.name);
               addMessage(`[${skill.name}] 激勵了 ${chargeBuffedCount} 個友方單位衝鋒！`);
               skillEffectApplied = true;
              break;

        case 'damage_reflect': // 反傷是施加給友軍
             let reflectCount = 0;
             friendlyUnits.forEach(unit => {
                 let d = dist(skillCenterX, skillCenterY, unit.x, unit.y);
                 if (d < (skill.range || 90)) {
                     unit.applyEffect(skill.name, 'damage_reflect', skill.value, skill.duration);
                     reflectCount++;
                 }
             });
              createBattlefieldEffect('area_buff', skillCenterX, skillCenterY, (skill.range || 90), skill.duration, color(180, 180, 180, 100), null, skill.name);
             addMessage(`[${skill.name}] 使 ${reflectCount} 個友方單位獲得反傷效果！`);
             skillEffectApplied = true;
             break;

        default:
            addMessage(`武將 ${general.name} 試圖發動未知技能類型: ${skill.type}`);
            skillEffectApplied = true; // 即使未知也進入冷卻
            break;
    }

    if (!skillEffectApplied) {
        // 技能失敗，重置冷卻和計時器
         skill.cooldown = 0;
         delete battleState.lastGeneralSkillTime[skillKey];
         addMessage(`技能 [${skill.name}] 未找到有效目標或無法施放。`);
    }
}


// =================================
// ===== END BATTLE (REVISED) ======
// =================================
function endBattle() {
    if (!battleState.attacker || !battleState.defender) {
        console.error("結束戰鬥時狀態錯誤！");
        gameState = 'MAP'; // 強制返回地圖
        return;
    }

    const attackerCity = findCityById(battleState.attacker.cityId);
    const defenderCity = findCityById(battleState.defender.cityId);

    if (!attackerCity || !defenderCity) {
        console.error("戰鬥結束時找不到城市數據！ Attacker:", battleState.attacker.cityId, "Defender:", battleState.defender.cityId);
        gameState = 'MAP';
        return;
    }

    const attackerFaction = findFactionById(battleState.attacker.factionId);
    const defenderFaction = findFactionById(battleState.defender.factionId);

    // 計算剩餘兵力 (基於單位數量 * 每單位士兵數)
    const remainingAttackerSoldiers = floor(battleState.attackerUnits.length * SOLDIERS_PER_UNIT * (battleState.attackerUnits.reduce((sum, u) => sum + u.hp / u.maxHp, 0) / battleState.attackerUnits.length || 1)); // 考慮單位平均血量
    const remainingDefenderSoldiers = floor(battleState.defenderUnits.length * SOLDIERS_PER_UNIT * (battleState.defenderUnits.reduce((sum, u) => sum + u.hp / u.maxHp, 0) / battleState.defenderUnits.length || 1));

     // --- 勝負處理 ---
    if (battleState.battleWinner === battleState.attacker.factionId) {
        // 攻擊方勝利
        addMessage(`${attackerFaction.name} 攻佔了 ${defenderCity.name}！`);

        // 城市易主
        let originalOwner = defenderCity.owner;
        defenderCity.owner = battleState.attacker.factionId;
        defenderCity.soldiers = remainingAttackerSoldiers; // 勝方殘兵進駐
        defenderCity.food = max(100, floor(defenderCity.food * 0.3)); // 戰亂導致糧食大減
        defenderCity.defense = max(5, floor(defenderCity.defense * 0.5)); // 城防受損

        // 處理守方武將 (成為俘虜或下野 - 簡化為直接移除)
         if(battleState.defender.generals && battleState.defender.generals.length > 0) {
            addMessage(`${defenderCity.name} 的守將 ${battleState.defender.generals.map(g=>g.name).join(', ')} 被擊敗。`);
            battleState.defender.generals.forEach(gen => {
                 gen.location = null; // 武將下野
                 gen.factionId = null; // 失去歸屬
                 // TODO: 可以加入俘虜系統
                 const idx = availableGenerals.findIndex(g => g.id === gen.id);
                 if(idx === -1) availableGenerals.push(gen); // 放回在野人才庫
            });
         }
         defenderCity.generals = []; // 清空城市武將列表


        // 攻方武將入駐
        defenderCity.generals = [...battleState.attacker.generals];
        defenderCity.generals.forEach(gen => gen.location = defenderCity.id);

        // 原攻擊方城市變空城 (或留守少量兵力 - 這裡簡化為清空)
        // attackerCity.soldiers = 0; // 出征的兵力已經沒了
        attackerCity.generals = []; // 武將已轉移

        // 更新勢力城市計數
        updateFactionCityCounts();


    } else {
        // 防守方勝利
         addMessage(`${defenderFaction ? defenderFaction.name : '守軍'} 成功守住了 ${defenderCity.name}！`);

        // 攻擊方撤退，殘兵回城
        attackerCity.soldiers += remainingAttackerSoldiers; // 殘兵歸建
        defenderCity.soldiers = remainingDefenderSoldiers; // 守方損失
        defenderCity.food = max(100, floor(defenderCity.food * 0.8)); // 守城消耗糧食
        defenderCity.defense = max(5, floor(defenderCity.defense * 0.9)); // 城防輕微受損

         // 攻方武將撤回
         if (battleState.attacker.generals && battleState.attacker.generals.length > 0) {
             addMessage(`攻方武將 ${battleState.attacker.generals.map(g=>g.name).join(', ')} 撤回 ${attackerCity.name}。`);
             // 武將已在 attackerCity.generals 中 (因為是從那裡複製過來的)
         }
    }

    // --- 清理戰鬥狀態 ---
    battleState = { // 重置為初始空狀態
        attacker: null,
        defender: null,
        attackerUnits: [],
        defenderUnits: [],
        battlePhase: 'DEPLOY',
        battleTimer: 0,
        battleWinner: null,
        playerCommand: null,
        damageTexts: [],
        battlefieldEffects: [],
        lastGeneralSkillTime: {},
        projectiles: [],
        dialogues: []
    };
    selectedCity = null;
    targetCity = null;
    clearHighlights();
    gameState = 'MAP'; // 返回地圖

    checkWinLossCondition(); // 檢查遊戲是否結束
}


function endPlayerTurn() {
    if (currentTurn !== PLAYER_FACTION_ID || gameState !== 'MAP') return; // 確保是玩家回合且在地圖界面

    addMessage("玩家回合結束。");
    currentTurn++; // 切換到下一個勢力 ID

    // 循環回合
    if (currentTurn >= factions.length) {
        currentTurn = 0; // 回到第一個勢力 (可能是玩家或 AI)
    }

    nextTurn(); // 處理回合推進邏輯
}

// --- World State Update (每月/每回合) ---
function updateWorldState() {
     console.log(`Updating world state for ${gameYear} Year ${gameMonth} Month`);
    // 城市自然增長/消耗
    cities.forEach(city => {
        if (city.owner !== null) {
            // 糧食增長 (與開發度/季節相關 - 簡化)
            let foodIncrease = floor(city.defense * 10 + (city.generals.find(g => g.leadership > 85) ? 500 : 100)); // 簡化增長
            // 糧食消耗 (與士兵數相關)
            let foodConsumption = ceil(city.soldiers * 0.1); // 每 10 個士兵消耗 1 糧
            city.food += foodIncrease - foodConsumption;
            city.food = max(0, city.food); // 糧食不能為負

            // 士兵增長 (募兵/訓練速度 - 簡化為少量自然增長，如果糧食充足)
            if (city.food > city.soldiers * 0.5 && city.soldiers < city.defense * 500) { // 糧食充足且未達容量上限
                 let soldierIncrease = floor(city.soldiers * 0.01 + city.generals.reduce((sum, g) => sum + g.leadership * 0.1, 0));
                 city.soldiers += max(10, soldierIncrease); // 每回合至少增長一點
            }

             // 城市人口/經濟增長 (未來可擴充)
             // city.population += ...
             // city.economy += ...

             // 忠誠度/民心變化 (未來可擴充)
             // city.loyalty += ...

             // 城防恢復 (少量)
             city.defense = min(100, city.defense + 0.1); // 非常緩慢的恢復

             // 武將經驗/屬性成長 (未來可擴充)
             // city.generals.forEach(g => g.experience += ...);
        }

         // 所有武將技能冷卻減少 (在地圖上)
        city.generals.forEach(gen => {
            if (gen.skillCooldown > 0) {
                // gen.skillCooldown--; // 在戰鬥外冷卻太快，改成按月減少
                 // 或者冷卻時間只在戰鬥中計算和減少
            }
        });
    });

     // 更新在野武將的冷卻 (如果有的話)
     availableGenerals.forEach(gen => {
         if (gen.skillCooldown > 0) {
             // gen.skillCooldown--;
         }
     });

    // 時間推進
    gameMonth++;
    if (gameMonth > 12) {
        gameMonth = 1;
        gameYear++;
        addMessage(`新的一年開始了！現在是 ${gameYear} 年。`);
        // 年度事件檢查
        checkAnnualEvents();
    }
    addMessage(`時間進入 ${gameYear} 年 ${gameMonth} 月`);

    checkGameEvents(); // 檢查隨機事件
}

function nextTurn() {
    console.log(`Starting turn for Faction ID: ${currentTurn}`);
    updateWorldState(); // 更新世界狀態 (每月效果)

    const currentFaction = findFactionById(currentTurn);
    if (!currentFaction) {
        console.error(`Error: Cannot find faction for turn ID: ${currentTurn}. Resetting to Player.`);
        currentTurn = PLAYER_FACTION_ID; // 出錯時回到玩家回合
        // 強制結束AI回合，輪到玩家
        switchToPlayerTurn();
        return;
    }

    console.log(`--- ${currentFaction.name}的回合 (${gameYear}年${gameMonth}月) ---`);
    addMessage(`--- ${currentFaction.name} 的回合 ---`);

    deselectCities();
    clearHighlights();

    if (currentFaction.isAI) {
        // runAITurn(); // 使用單回合 AI 邏輯
         setTimeout(runAITurn, 500); // 加入延遲，讓玩家能看到訊息
    } else {
        // Player's turn - already handled by waiting for player input
        addMessage(`輪到你了，請下達指令。`);
        // 可以在這裡檢查玩家是否有城市，如果沒有直接遊戲結束
         if (factions[PLAYER_FACTION_ID].citiesCount === 0 && gameState !== 'GAME_OVER') {
             addMessage("你已失去所有領地！");
             gameState = 'GAME_OVER';
         }
    }
    checkWinLossCondition(); // 每次回合開始前檢查一次勝負
}

// --- AI 邏輯 (單回合處理) ---
function runAITurn() {
     if (gameState === 'BATTLE') {
         console.log("AI Turn skipped: Battle in progress.");
         // 如果 AI 正在戰鬥中，可能需要不同的處理，或者等待戰鬥結束
         // 為了簡化，我們先跳過這個回合的 AI 行動
         endAITurn(); // 直接結束 AI 回合
         return;
     }

    const aiFaction = findFactionById(currentTurn);
    if (!aiFaction || !aiFaction.isAI) {
        console.error("runAITurn called for non-AI or invalid faction:", currentTurn);
        switchToPlayerTurn(); // 切換回玩家
        return;
    }
    addMessage(`[AI] ${aiFaction.name} 正在思考...`);

    let aiCities = cities.filter(c => c.owner === aiFaction.id);
    let potentialTargets = []; // AI 可能攻擊的目標列表
    let actionsTaken = 0; // AI 本回合執行的動作計數
    const MAX_AI_ACTIONS = 2; // AI 每回合最多執行幾個動作

    // 1. 遍歷 AI 控制的城市，決定行動
    for (let city of aiCities) {
         if (actionsTaken >= MAX_AI_ACTIONS) break; // 達到行動上限

        // --- 內政決策 (簡化) ---
        let wantsDevelop = city.food < city.soldiers * 1.5 || random() < 0.2; // 糧食不足或隨機發展
        let wantsRecruit = city.soldiers < city.defense * 300 && city.food > city.soldiers * 1.0 && random() < 0.4; // 兵力未滿且糧食尚可
        let wantsReinforce = city.defense < 70 && city.food > 3000 && random() < 0.15; // 城防不高且有餘糧

        if (wantsDevelop && city.food < 50000) { // 簡單的發展決策
             city.food += 3000; // 模擬執行發展指令
             addMessage(`[AI] ${aiFaction.name} 在 ${city.name} 進行了開墾。`);
             actionsTaken++;
             continue; // 執行完內政，跳過本城市後續判斷
        } else if (wantsRecruit && city.soldiers < 100000) {
             let recruitAmount = floor(city.defense * 5 + 500);
             city.soldiers += recruitAmount;
             city.food -= floor(recruitAmount * 0.5); // 招兵消耗糧食
             addMessage(`[AI] ${aiFaction.name} 在 ${city.name} 招募了 ${recruitAmount} 士兵。`);
             actionsTaken++;
             continue;
         } else if (wantsReinforce) {
             city.defense = min(100, city.defense + 5);
             city.food -= 1500;
             addMessage(`[AI] ${aiFaction.name} 在 ${city.name} 加固了城防。`);
             actionsTaken++;
             continue;
         }

        // --- 軍事決策：尋找攻擊目標 ---
        if (city.soldiers > (city.defense * 100 + 5000) * 0.8) { // 兵力較充足時考慮進攻 (閾值與防禦掛鉤)
             city.adjacent.forEach(adjId => {
                const adjCity = findCityById(adjId);
                 // 目標是敵人城市，且兵力對比有優勢 (例如我方兵力 > 敵方兵力 * 1.1)
                 // 或者目標是中立城市，且我方兵力足夠 (例如 > 5000)
                 const isEnemy = adjCity && adjCity.owner !== null && adjCity.owner !== aiFaction.id;
                 const isNeutral = adjCity && adjCity.owner === null;

                 if (isEnemy && adjCity.soldiers < city.soldiers * 0.9) { // 攻打較弱敵人
                     potentialTargets.push({ fromCity: city, targetCity: adjCity, strengthDiff: city.soldiers - adjCity.soldiers });
                 } else if (isNeutral && city.soldiers > 8000) { // 攻打中立城市
                     potentialTargets.push({ fromCity: city, targetCity: adjCity, strengthDiff: city.soldiers }); // 中立城市兵力視為0
                 }
            });
        }
    } // end of city loop

    // 2. 執行攻擊 (如果找到目標且行動點數允許)
    if (potentialTargets.length > 0 && actionsTaken < MAX_AI_ACTIONS) {
         // 選擇最佳目標 (例如兵力差距最大，或最弱的敵人)
         potentialTargets.sort((a, b) => b.strengthDiff - a.strengthDiff); // 按實力差排序，優先打弱的
         let attackChoice = potentialTargets[0];

         addMessage(`[AI] ${aiFaction.name} 決定從 ${attackChoice.fromCity.name} 出兵攻打 ${attackChoice.targetCity.name}！`);

         // --- 模擬 AI 戰鬥準備和執行 ---
         selectedCity = attackChoice.fromCity; // 設置全局變量以便 startBattlePrep 使用
         targetCity = attackChoice.targetCity;
         startBattlePrep(); // 進入準備階段 (設置 battleState)

         if (gameState === 'BATTLE_PREP') { // 確保準備成功
             // AI 直接開始戰鬥並快速結算
             startBattle(); // 部署單位
             // resolveAIBattle(battleState); // <<-- **改用詳細模擬**
             simulateAIBattle(); // **使用新的模擬函數**
         } else {
             addMessage(`[AI] ${aiFaction.name} 出兵準備失敗。`);
             // 重置選擇，避免影響玩家
             selectedCity = null;
             targetCity = null;
         }
         actionsTaken++;
    } else if (actionsTaken == 0) {
         addMessage(`[AI] ${aiFaction.name} 本回合選擇休整。`);
    }

    // 3. AI 回合結束
    endAITurn();
}

// ===================================
// ===== AI BATTLE SIMULATION ======
// ===================================
function simulateAIBattle() {
     if (gameState !== 'BATTLE' || battleState.battlePhase !== 'FIGHTING') {
         console.error("AI Simulation Error: Not in fighting phase.");
         // 如果模擬出錯，嘗試強制結束戰鬥，避免卡死
         if(battleState.attacker && battleState.defender){
             resolveAIBattle(battleState); // 用舊的快速結算兜底
         } else {
             gameState = 'MAP'; // 無法結算，退回地圖
         }
         return;
     }

    addMessage("[AI戰鬥模擬中...]");
    console.log("Simulating AI Battle...");

    const MAX_SIMULATION_FRAMES = BATTLE_DURATION_TARGET_FRAMES * 1.5; // 模擬幀數上限，防止死循環
    let simulationFrame = 0;

    // 儲存當前 playerCommand, 模擬完畢後恢復
    let originalPlayerCommand = battleState.playerCommand;
    // AI 簡單指令邏輯: 如果兵力優勢大則衝鋒，劣勢則防守
    let attackerAdvantage = battleState.attackerUnits.length / (battleState.defenderUnits.length + 1); // 避免除零
    if (battleState.attacker.factionId !== PLAYER_FACTION_ID && battleState.defender.factionId === PLAYER_FACTION_ID) { // AI 是攻擊方
        battleState.playerCommand = attackerAdvantage > 1.3 ? 'charge' : (attackerAdvantage < 0.7 ? 'defend' : 'standard');
    } else if (battleState.defender.factionId !== PLAYER_FACTION_ID && battleState.attacker.factionId === PLAYER_FACTION_ID) { // AI 是防守方
         battleState.playerCommand = attackerAdvantage > 1.3 ? 'defend' : (attackerAdvantage < 0.7 ? 'charge' : 'standard'); // 敵人太強就龜縮
    } else { // 雙方都是 AI
        // 可以讓雙方都根據優勢判斷，或者簡化為 standard
        battleState.playerCommand = 'standard';
    }


    // 循環執行 updateBattle 邏輯，直到戰鬥結束或達到幀數上限
    while (battleState.battlePhase === 'FIGHTING' && simulationFrame < MAX_SIMULATION_FRAMES) {
        updateBattle(); // 執行一幀的戰鬥邏輯
        simulationFrame++;

        // AI 模擬中，不需要繪製，只需要更新邏輯
        // 但 updateBattle 內部可能包含繪製相關的計算，需要小心

         // 可以在模擬中加入 AI 指令變化 (如果需要更複雜的 AI)
         // if (simulationFrame % 120 === 0) { // 每 2 秒重新評估一次指令?
             // ... AI 重新評估指令 ...
         // }

         // 模擬 AI 使用技能 (updateBattle 內部已有簡易邏輯)
    }

    // 恢復玩家指令
    battleState.playerCommand = originalPlayerCommand;

    if (simulationFrame >= MAX_SIMULATION_FRAMES) {
        console.warn("AI Battle simulation reached max frames. Forcing end.");
        // 如果模擬超時，強制結束戰鬥 (例如算平局或按當前兵力判斷)
        let attHP = battleState.attackerUnits.reduce((s, u) => s + u.hp, 0);
        let defHP = battleState.defenderUnits.reduce((s, u) => s + u.hp, 0);
        battleState.battleWinner = attHP > defHP ? battleState.attacker.factionId : battleState.defender.factionId;
        battleState.battlePhase = 'END';
        addMessage("[AI戰鬥超時，強制結束]");
    } else {
         console.log(`AI Battle simulation finished in ${simulationFrame} frames.`);
    }


    // 模擬結束後，調用 endBattle 處理戰後結果
    endBattle(); // endBattle 會處理 gameState 切換和後續檢查

    console.log("AI Battle simulation complete. Returning to MAP.");
}



// --- AI 回合結束處理 ---
function endAITurn() {
    const aiFaction = findFactionById(currentTurn);
    addMessage(`--- ${aiFaction.name} 回合結束 ---`);
    console.log(`--- Faction ${aiFaction.name} (ID: ${currentTurn}) turn ended ---`);

    currentTurn++; // 切換到下一個勢力
    if (currentTurn >= factions.length) {
        currentTurn = 0; // 循環回第一個勢力
    }

     // 啟動下一個回合
     // 不能直接調用 nextTurn()，因為 runAITurn 是異步的 (用了 setTimeout)
     // 應該在 runAITurn 完全結束後 (包括可能的戰鬥模擬)，再觸發 nextTurn
     // 現在的結構是 runAITurn -> (simulateAIBattle -> endBattle) -> endAITurn
     // 所以可以在 endAITurn 的最後安排下一個回合

     // 如果下一個回合是玩家，直接調用 switchToPlayerTurn
     if (currentTurn === PLAYER_FACTION_ID) {
         // 使用 setTimeout 確保 AI 的所有消息都顯示完畢再輪到玩家
         setTimeout(switchToPlayerTurn, 100);
     } else {
         // 如果下一個還是 AI，則延遲後啟動新的 AI 回合
         setTimeout(nextTurn, 300); // 給一點間隔
     }
}


// --- 切換回玩家回合 ---
function switchToPlayerTurn() {
    currentTurn = PLAYER_FACTION_ID;
    const playerFaction = findFactionById(PLAYER_FACTION_ID);
    if (!playerFaction) {
        console.error("Player faction not found!");
        gameState = 'GAME_OVER'; // 無法進行遊戲
        return;
    }
    addMessage(`--- 輪到 ${playerFaction.name} 的回合 ---`);
    console.log("--- Switching to Player Turn ---");

    // 回合開始時的檢查和處理
    checkGameEvents();
    updateFactionCityCounts(); // 更新一下玩家城市數
    checkWinLossCondition(); // 再次檢查勝負

    if (gameState !== 'GAME_OVER') { // 確保遊戲還沒結束
        gameState = 'MAP'; // 確保玩家在主地圖界面
        selectedCity = null; // 清除選擇，讓玩家重新開始
        targetCity = null;
        clearHighlights();
        addMessage("請選擇城市並下達指令。");
    }
}


function checkGameEvents() {
    // 增加更多事件類型
    if (random() < 0.08) { // 發生事件的機率
        let eventType = random(['good_harvest', 'bad_harvest', 'plague', 'bandit', 'good_omen', 'bad_omen']);
        let targetCity = random(cities.filter(c => c.owner !== null)); // 隨機選一個有主的城市

        if (targetCity) {
            const faction = findFactionById(targetCity.owner);
            switch (eventType) {
                case 'good_harvest':
                    let foodBonus = floor(random(2000, 8000) * (targetCity.defense / 50));
                    targetCity.food += foodBonus;
                    addMessage(`[事件] ${targetCity.name} 迎來大豐收！糧草增加了 ${foodBonus}！`);
                    break;
                case 'bad_harvest':
                     let foodLoss = floor(random(1000, 5000));
                     targetCity.food = max(0, targetCity.food - foodLoss);
                     addMessage(`[事件] ${targetCity.name} 收成欠佳！糧草損失了 ${foodLoss}！`);
                     break;
                case 'plague':
                    let soldierLoss = floor(random(500, 2000) * (1 - targetCity.defense / 150)); // 防禦高抵抗力強
                     soldierLoss = max(100, soldierLoss); // 最少損失100
                    targetCity.soldiers = max(0, targetCity.soldiers - soldierLoss);
                    addMessage(`[事件] ${targetCity.name} 爆發瘟疫！士兵減少了 ${soldierLoss}！`);
                    break;
                case 'bandit':
                     let foodStolen = floor(random(500, 3000));
                     targetCity.food = max(0, city.food - foodStolen);
                     // 未來可加入剿匪選項
                     addMessage(`[事件] 一股土匪襲擊了 ${targetCity.name} 的郊外，損失了 ${foodStolen} 糧草！`);
                    break;
                 case 'good_omen':
                     // 祥瑞，提升士氣/忠誠度 (未來實現) 或直接加資源
                     let goldBonus = floor(random(50, 200));
                     // targetCity.gold += goldBonus; // 假設有金錢
                      targetCity.food += goldBonus * 10; // 暫代
                     addMessage(`[事件] ${targetCity.name} 出現祥瑞之兆！民心振奮 (獲得 ${goldBonus * 10} 資源)。`);
                     break;
                 case 'bad_omen':
                     // 凶兆，降低士氣/忠誠度 (未來實現) 或直接損失資源
                     let popLoss = floor(random(100, 500));
                     // targetCity.population -= popLoss; // 假設有人口
                     addMessage(`[事件] ${targetCity.name} 出現不詳之兆，人心惶惶。`);
                     break;
            }
        }
    }
}

function checkAnnualEvents() {
     // 例如：特定年份的歷史事件觸發（黃巾之亂、董卓之亂等）
     if (gameYear === 184 && gameMonth === 1) {
         addMessage("[歷史事件] 黃巾之亂爆發！天下大亂！");
         // 可以在此處觸發特殊效果，例如部分城市變為黃巾軍勢力，或出現特殊任務
     }
     // 可以添加更多年度事件...
}


function updateFactionCityCounts() {
     factions.forEach(f => {
         f.citiesCount = cities.filter(c => c.owner === f.id).length;
     });
     console.log("Faction city counts updated:", factions.map(f => ({id: f.id, name: f.name, count: f.citiesCount})));
 }


function checkWinLossCondition() {
    updateFactionCityCounts(); // 先更新數量

    const playerFaction = findFactionById(PLAYER_FACTION_ID);
    let activeFactions = new Set();
    cities.forEach(city => {
        if (city.owner !== null) {
            activeFactions.add(city.owner);
        }
    });
     const numberOfActiveFactions = activeFactions.size;

    // 失敗條件：玩家沒有任何城市
    if (playerFaction && playerFaction.citiesCount === 0 && factions.length > 1) { // 要確保不是只剩玩家自己
        if (gameState !== 'GAME_OVER') { // 避免重複觸發
            addMessage("你失去了所有城市！遊戲結束！");
             console.log("Game Over - Player Defeated");
            gameState = 'GAME_OVER';
        }
        return true; // 遊戲結束
    }

    // 勝利條件 1：玩家佔領所有城市
    if (playerFaction && playerFaction.citiesCount === cities.length) {
         if (gameState !== 'GAME_OVER') {
            addMessage("恭喜你統一天下！遊戲結束！");
             console.log("Game Over - Player Victory (Conquest)");
            gameState = 'GAME_OVER';
         }
        return true;
    }

    // 勝利條件 2：只剩下一個勢力存活
    if (numberOfActiveFactions === 1) {
         const winnerId = [...activeFactions][0];
         const winnerFaction = findFactionById(winnerId);
          if (gameState !== 'GAME_OVER') {
             if (winnerId === PLAYER_FACTION_ID) {
                 addMessage("恭喜你統一天下！遊戲結束！");
                 console.log("Game Over - Player Victory (Last Man Standing)");
             } else {
                 addMessage(`${winnerFaction.name} 統一天下了！遊戲結束！`);
                 console.log(`Game Over - ${winnerFaction.name} Victory`);
             }
            gameState = 'GAME_OVER';
          }
         return true;
    }

    return false; // 遊戲繼續
}

function determineWinner() {
     updateFactionCityCounts();
     const playerFaction = findFactionById(PLAYER_FACTION_ID);
     let activeFactions = new Set();
     cities.forEach(city => {
         if (city.owner !== null) {
             activeFactions.add(city.owner);
         }
     });
     const numberOfActiveFactions = activeFactions.size;

     if (playerFaction && playerFaction.citiesCount === cities.length) return playerFaction;
     if (numberOfActiveFactions === 1) return findFactionById([...activeFactions][0]);
     if (playerFaction && playerFaction.citiesCount === 0 && numberOfActiveFactions > 0) return null; // Player lost, no winner yet if others remain

     // 如果沒有明確勝者 (例如卡死或特殊情況)，返回 null
     return null;
 }


function resetGame() {
    addMessage("--- 重新開始遊戲 ---");
    console.log("Resetting game...");
    gameState = 'MAP';
    currentTurn = PLAYER_FACTION_ID;
    gameYear = 184;
    gameMonth = 1;
    messageLog = ["遊戲開始！"];
    selectedCity = null;
    targetCity = null;
    internalAffairsCards = [];
    battleState = { // 重置為初始空狀態
        attacker: null,
        defender: null,
        attackerUnits: [],
        defenderUnits: [],
        battlePhase: 'DEPLOY',
        battleTimer: 0,
        battleWinner: null,
        playerCommand: null,
        damageTexts: [],
        battlefieldEffects: [],
        lastGeneralSkillTime: {},
        projectiles: [],
        dialogues: []
    };
    availableGenerals = [];
    animations = []; // 清空通用動畫

    initializeGameData(); // 重新初始化所有數據
    console.log("Game reset complete.");
}

// --- 輔助與工具函式 ---

function findCityById(id) {
    return cities.find(c => c.id === id);
}

function findFactionById(id) {
    // ID 可能是 null 或 undefined
    if (id === null || id === undefined) return null;
    return factions.find(f => f.id === id);
}

function findGeneralById(id) {
    return generals.find(g => g.id === id);
}
function findGeneralByName(name) {
    return generals.find(g => g.name === name);
}

function assignGeneralToCity(general, cityId) {
    if (!general || cityId === null || cityId === undefined) return;
    const city = findCityById(cityId);
    if (!city) return;

    // 從舊位置移除 (如果有的話)
    if (general.location !== null && general.location !== undefined) {
        const oldCity = findCityById(general.location);
        if (oldCity && oldCity.generals) {
            const indexInOld = oldCity.generals.findIndex(g => g.id === general.id);
            if (indexInOld !== -1) {
                oldCity.generals.splice(indexInOld, 1);
                console.log(`Removed ${general.name} from ${oldCity.name}`);
            }
        }
    }
    // 從 availableGenerals 移除
    const availableIndex = availableGenerals.findIndex(g => g.id === general.id);
    if (availableIndex !== -1) {
        availableGenerals.splice(availableIndex, 1);
         console.log(`Removed ${general.name} from available generals.`);
    }


    // 分配到新城市
    general.location = cityId;
    general.factionId = city.owner; // 歸屬設為城市擁有者
    if (!city.generals) city.generals = []; // 確保列表存在
    if (!city.generals.some(g => g.id === general.id)) { // 避免重複添加
        city.generals.push(general);
    }
    console.log(`Assigned ${general.name} to ${city.name}`);
}

// --- 新增：創建傷害文字輔助函數 ---
function createDamageText(x, y, text, color = color(255, 0, 0)) {
     if (!battleState.damageTexts) battleState.damageTexts = [];
    battleState.damageTexts.push({
        text: text.toString(),
        x: x + random(-5, 5), // 稍微隨機位置
        y: y - 10 + random(-5, 5), // 在單位上方
        timer: DAMAGE_TEXT_DURATION,
        color: color
    });
}

// --- 新增：創建戰場特效輔助函數 ---
function createBattlefieldEffect(type, x, y, radius, duration, color, ownerUnit = null, skillName = null) {
     if (!battleState.battlefieldEffects) battleState.battlefieldEffects = [];
     battleState.battlefieldEffects.push({
         type: type,
         x: x,
         y: y,
         radius: radius,
         duration: duration,
         initialDuration: duration, // 保存初始持續時間用於動畫
         color: color,
         ownerUnit: ownerUnit, // 用於跟隨單位的特效
         skillName: skillName, // 用於識別和移除特效
    });
}

function showDialogueForGeneral(general, isAttackerSide, text) {
    const list = isAttackerSide ? battleState.attacker.generals : battleState.defender.generals;
    const index = list ? list.findIndex(g => g.id === general.id) : -1;
    if (index === -1) return;
    const uiY = BATTLE_AREA_HEIGHT - 60;
    const generalSpacing = 120;
    const startX = isAttackerSide ? 60 : width - 60;
    const genX = isAttackerSide ? startX + index * generalSpacing : startX - index * generalSpacing;
    const genY = uiY;
    battleState.dialogues.push({ text, x: genX, y: genY - 35, timer: DIALOGUE_DURATION });
}

function assignGeneralTargets() {
    if (!battleState.attacker || !battleState.defender) return;
    const attackers = battleState.attacker.generals || [];
    const defenders = battleState.defender.generals || [];
    attackers.forEach(gen => {
        if (defenders.length > 0) {
            const target = random(defenders);
            gen.battleTarget = target.id;
            showDialogueForGeneral(gen, true, `目標: ${target.name}`);
        }
    });
    defenders.forEach(gen => {
        if (attackers.length > 0) {
            const target = random(attackers);
            gen.battleTarget = target.id;
            showDialogueForGeneral(gen, false, `盯上 ${target.name}`);
        }
    });
}

// --- 動畫與特效 (通用，非戰鬥單位) ---
let animations = []; // 如：城市升級、事件提示等非戰鬥動畫

function updateAnimations() {
    for (let i = animations.length - 1; i >= 0; i--) {
        animations[i].update();
         if (gameState !== 'BATTLE') { // 只有非戰鬥狀態才繪製通用動畫
            animations[i].draw();
        }
        if (animations[i].isFinished()) {
            animations.splice(i, 1);
        }
    }
}

	// ==================================
// ===== ARROW CLASS DEFINITION =====
// ==================================
class Arrow {
    constructor(startX, startY, targetX, targetY, speed, damage, factionId, color) {
        this.x = startX;
        this.y = startY;
        this.targetX = targetX + random(-5, 5); // 目標稍微隨機，避免完全重疊
        this.targetY = targetY + random(-5, 5);
        this.speed = speed * 1.5; // 箭矢速度可以比單位快
        this.damage = damage;
        this.factionId = factionId; // 記錄發射方陣營
        this.color = color;
        this.angle = atan2(this.targetY - this.y, this.targetX - this.x);
        this.length = 10; // 箭的長度
        this.thickness = 2; // 箭的粗細
        this.hit = false; // 是否已擊中
        this.travelledDistance = 0;
        this.maxDistance = dist(startX, startY, targetX, targetY) * 1.2; // 最大飛行距離，防止無限飛行
    }

    update() {
        if (this.hit) return; // 擊中後不再移動

        // 移動
        let dx = cos(this.angle) * this.speed;
        let dy = sin(this.angle) * this.speed;
        this.x += dx;
        this.y += dy;
        this.travelledDistance += this.speed;

        // 檢查是否到達目標點附近或超過最大距離
        let distanceToTarget = dist(this.x, this.y, this.targetX, this.targetY);
        if (distanceToTarget < this.speed || this.travelledDistance > this.maxDistance) {
            // 觸發命中檢測（即使沒到精確點，也認為可能命中了附近的單位）
             this.checkHit(); // 執行命中檢測並可能造成傷害
             this.hit = true; // 標記為已處理（無論是否真的打中人）
        }
    }

    checkHit() {
        // 確定要檢查的敵方單位列表
        let potentialTargets = (this.factionId === battleState.attacker.factionId) ? battleState.defenderUnits : battleState.attackerUnits;

        for (let unit of potentialTargets) {
            if (unit.hp > 0 && unit.state !== 'dying' && unit.state !== 'dead') {
                 // 檢查箭矢當前位置是否在敵方單位碰撞範圍內
                let d = dist(this.x, this.y, unit.x, unit.y);
                if (d < unit.size) { // 碰撞半徑可以調整
                    unit.takeDamage(this.damage, 'arrow'); // 應用傷害
                    createDamageText(unit.x, unit.y, this.damage, color(200, 200, 0)); // 箭矢傷害黃色
                    this.hit = true; // 標記擊中
                    return true; // 已找到命中目標
                }
            }
        }
        return false; // 沒有命中任何單位
    }

    draw() {
        if (this.hit) return; // 擊中後不繪製

        push();
        translate(this.x, this.y);
        rotate(this.angle);
        stroke(red(this.color), green(this.color), blue(this.color)); // 使用單位顏色
        strokeWeight(this.thickness);
        line(0, 0, -this.length, 0); // 繪製箭身
        // 繪製箭頭 (簡單三角形)
        // fill(this.color);
        // noStroke();
        // beginShape();
        // vertex(-this.length, 0);
        // vertex(-this.length - 4, -2);
        // vertex(-this.length - 4, 2);
        // endShape(CLOSE);
        pop();
    }

    isOffScreen() {
        return this.x < 0 || this.x > width || this.y < 0 || this.y > BATTLE_AREA_HEIGHT;
    }
}


// --- 動畫 Class (保持不變) ---
// class ExpandingCircle { ... }
// class PulseCircle { ... }
class ExpandingCircle {
    constructor(x, y, startRadius, endRadius, col, durationFrames) {
        this.x = x;
        this.y = y;
        this.startRadius = startRadius;
        this.endRadius = endRadius;
        this.color = col;
        this.duration = durationFrames;
        this.currentFrame = 0;
        this.currentRadius = startRadius;
    }

    update() {
        this.currentFrame++;
        let progress = this.currentFrame / this.duration;
        progress = easeOutCubic(progress); // 使用緩和函數
        this.currentRadius = lerp(this.startRadius, this.endRadius, progress);
        // 複製顏色對象以避免修改原始顏色
        this.displayColor = color(red(this.color), green(this.color), blue(this.color), map(progress, 0, 1, alpha(this.color), 0));
    }

    draw() {
        if (!this.displayColor) return; // 確保顏色已計算
        noFill();
        stroke(this.displayColor);
        strokeWeight(max(1, 3 * (1 - this.currentFrame / this.duration))); // 線條逐漸變細
        ellipse(this.x, this.y, this.currentRadius * 2, this.currentRadius * 2);
        noStroke();
    }

    isFinished() {
        return this.currentFrame >= this.duration;
    }
}

class PulseCircle {
    constructor(x, y, baseRadius, col, durationFrames) {
        this.x = x;
        this.y = y;
        this.baseRadius = baseRadius;
        this.color = col;
        this.duration = durationFrames;
        this.currentFrame = 0;
    }

    update() {
        this.currentFrame++;
    }

    draw() {
        let progress = this.currentFrame / this.duration;
        // 使用平滑的脈衝，例如 sin^2 或其他曲線
        let pulse = pow(sin(progress * PI), 2); // 0 -> 1 -> 0
        let currentRadius = this.baseRadius + pulse * 10;
        let currentAlpha = map(pulse, 0, 1, 50, alpha(this.color));

        // 複製顏色對象
        let displayColor = color(red(this.color), green(this.color), blue(this.color), currentAlpha);
        fill(displayColor);
        noStroke();
        ellipse(this.x, this.y, currentRadius * 2, currentRadius * 2);
    }

    isFinished() {
        return this.currentFrame >= this.duration;
    }
}
// 緩和函數 (範例)
function easeOutCubic(t) {
    return (--t) * t * t + 1;
}


// ==================================
// ===== UNIT CLASS DEFINITION ======
// ==================================
class Unit {
    constructor(x, y, factionId, unitColor, type, hp, attack, defense, speed, range, isAttacker, shape = 'ellipse', size = UNIT_VISUAL_SIZE, soldiers = SOLDIERS_PER_UNIT, characteristics = {}) {
        this.id = `unit_${factionId}_${type}_${random().toString(36).substring(2, 9)}`; // Unique ID
        this.x = x;
        this.y = y;
        this.factionId = factionId;
        this.color = unitColor;
        this.type = type; // 'SPEARMAN', 'SHIELDMAN', etc.
        this.shape = shape;
        this.size = size;
        this.soldiersRepresented = soldiers;

        this.maxHp = hp;
        this.hp = this.maxHp;
        this.attack = attack;
        this.defense = defense;
        this.baseSpeed = speed * BASE_MOVE_SPEED; // 基礎移動速度
        this.speed = this.baseSpeed; // 當前速度，可能受效果影響
        this.range = range; // 攻擊範圍
        this.isAttackerSide = isAttacker; // 標記是攻擊方還是防守方部署

        this.state = 'idle'; // 'idle', 'moving', 'attacking', 'fleeing', 'dying', 'dead'
        this.target = null; // 目標 Unit 物件
        this.attackCooldown = 0; // 攻擊冷卻計時器
        this.moveTargetPos = null; // 移動目標座標 {x, y}

        // 兵種特性
        this.characteristics = characteristics;
        this.chargeTimer = 0; // 騎兵衝鋒冷卻
        this.stationaryTimer = 0; // 弓兵原地不動計時器

        // 效果列表 { name, type, value, duration }
        this.effects = [];
        this.currentAttackMultiplier = 1.0;
        this.currentDefenseMultiplier = 1.0;
        this.currentSpeedMultiplier = 1.0;
        this.currentDamageReflect = 0; // 當前反傷比例

         this.deathTimer = 0; // 死亡動畫計時器
        this.animationOffset = random(TWO_PI);
        this.animCounter = 0;
        this.hitTimer = 0;
    }

    // --- 主要更新邏輯 ---
    update(enemyUnits, friendlyUnits) {
        this.animCounter++;
        if (this.hitTimer > 0) this.hitTimer--;
        if (this.hp <= 0 && this.state !== 'dying' && this.state !== 'dead') {
             this.state = 'dying';
             this.deathTimer = 30; // 死亡動畫持續幀數
             this.target = null; // 清除目標
             this.moveTargetPos = null;
             return; // 進入死亡狀態，停止其他行為
         }
         if (this.state === 'dying') {
             this.deathTimer--;
             if (this.deathTimer <= 0) {
                 this.state = 'dead'; // 標記為可移除
             }
             return; // 死亡動畫中
         }
         if (this.state === 'dead') {
             return; // 完全死亡，不做任何事
         }


        // 更新冷卻和計時器
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.chargeTimer > 0) this.chargeTimer--;
        if (this.state === 'attacking' || this.state === 'idle') this.stationaryTimer++; else this.stationaryTimer = 0;


        // 應用玩家指令效果
        this.applyPlayerCommand();


        // --- 行為決策 ---
        // 1. 尋找目標
        if (!this.target || this.target.hp <= 0 || !this.targetInRange()) {
            this.findTarget(enemyUnits);
        }

        // 2. 根據目標和狀態行動
        if (this.target && this.target.hp > 0) {
            let distanceToTarget = dist(this.x, this.y, this.target.x, this.target.y);

            // 是否在攻擊範圍內？
            if (distanceToTarget <= this.range) {
                 // 停止移動 (如果正在移動)
                 this.moveTargetPos = null;
                 // 檢查攻擊冷卻
                 if (this.attackCooldown === 0) {
                     this.state = 'attacking';
                     this.performAttack(this.target);
                 } else {
                      // 在範圍內但冷卻中，保持 idle 或 attacking 狀態等待
                      if (this.state !== 'attacking') this.state = 'idle';
                 }
             } else {
                // 不在範圍內，向目標移動
                this.state = 'moving';
                this.moveTowards(this.target.x, this.target.y, friendlyUnits); // 加入避讓友軍邏輯
            }
        } else {
            // 沒有目標，原地待命或向戰場中心移動
            this.state = 'idle';
             // 閒置時可以緩慢向戰場中心或預設前進方向移動
             this.moveTowards(this.isAttackerSide ? width * 0.6 : width * 0.4, this.y, friendlyUnits, this.speed * 0.1); // 緩慢移動
        }

        // 更新速度 (如果受效果影響)
         this.speed = this.baseSpeed * this.currentSpeedMultiplier;
         // 限制單位在戰場區域內
        this.constrainPosition();
    }

    // --- 尋找目標 ---
    findTarget(enemyUnits) {
        let nearestEnemy = null;
        let minDistance = Infinity;

        enemyUnits.forEach(enemy => {
            if (enemy.hp > 0 && enemy.state !== 'dying' && enemy.state !== 'dead') {
                let d = dist(this.x, this.y, enemy.x, enemy.y);
                 // 簡單優先級：近戰優先打最近的，遠程優先打威脅大的或脆皮的 (待實現)
                 // 弓兵優先打進入其射程的最近單位
                 if (this.type === 'ARCHER' && d > this.range) {
                     // 如果敵人不在射程內，弓兵可以選擇不主動追擊太遠的目標
                     // 或者選擇最近的進入射程的目標
                     // 這裡先簡化，還是找最近的
                 }

                // 考慮目標的威脅性或價值 (例如優先打弓兵、騎兵?) - 待擴充
                 let priorityFactor = 1.0;
                 if (this.type === 'SPEARMAN' && enemy.type === 'CAVALRY') priorityFactor = 0.8; // 槍兵優先找騎兵 (距離權重降低)
                 if (this.type === 'CAVALRY' && enemy.type === 'ARCHER') priorityFactor = 0.7; // 騎兵優先找弓兵

                 let weightedDistance = d * priorityFactor;

                if (weightedDistance < minDistance) {
                    minDistance = weightedDistance;
                    nearestEnemy = enemy;
                }
            }
        });

        this.target = nearestEnemy;
        if (this.target) this.state = 'moving'; // 找到目標就開始移動
        else this.state = 'idle';
    }

    // --- 檢查目標是否在範圍內 ---
    targetInRange() {
        if (!this.target) return false;
        let d = dist(this.x, this.y, this.target.x, this.target.y);
        return d <= this.range;
    }


    // --- 移動邏輯 ---
    moveTowards(targetX, targetY, friendlyUnits, customSpeed = null) {
         let currentSpeed = (customSpeed !== null ? customSpeed : this.speed);
         if (currentSpeed <= 0) return; // 不能移動

        let angle = atan2(targetY - this.y, targetX - this.x);
        let dx = cos(angle) * currentSpeed;
        let dy = sin(angle) * currentSpeed;

        // --- 簡單的碰撞躲避 ---
        let separationForceX = 0;
        let separationForceY = 0;
        let avoidanceRadius = this.size * 1.5; // 躲避範圍
        let neighborCount = 0;

        friendlyUnits.forEach(other => {
            if (other !== this && other.hp > 0) {
                let d = dist(this.x, this.y, other.x, other.y);
                if (d < avoidanceRadius && d > 0) {
                    let diffX = this.x - other.x;
                    let diffY = this.y - other.y;
                    separationForceX += diffX / d; // 力度與距離成反比
                    separationForceY += diffY / d;
                    neighborCount++;
                }
            }
        });

         if (neighborCount > 0) {
             separationForceX /= neighborCount;
             separationForceY /= neighborCount;
             // 將躲避力添加到移動向量，權重可以調整
             dx += separationForceX * 0.5; // 躲避力的影響程度
             dy += separationForceY * 0.5;
             // 重新標準化移動向量 (可選，避免速度過快)
              let moveMagnitude = sqrt(dx*dx + dy*dy);
              if(moveMagnitude > 0){
                  dx = (dx / moveMagnitude) * currentSpeed;
                  dy = (dy / moveMagnitude) * currentSpeed;
              }
         }


        this.x += dx;
        this.y += dy;
    }


    // --- 攻擊邏輯 ---
	performAttack(target) {
        if (!target || target.hp <= 0 || this.attackCooldown > 0) return;

        // 計算基礎傷害值 (用於箭矢)
        let damage = this.calculateDamage(target);

        if (this.type === 'ARCHER') {
            // --- 弓兵：發射箭矢 ---
            const arrowSpeed = 8; // 箭矢飛行速度
            let newArrow = new Arrow(this.x, this.y, target.x, target.y, arrowSpeed, damage, this.factionId, this.color);
            battleState.projectiles.push(newArrow);

             // 設置弓兵自身的攻擊冷卻
             let cooldown = BASE_ATTACK_COOLDOWN;
             if (this.stationaryTimer > 120 && this.characteristics.stationaryAttackBonus) {
                 cooldown /= this.characteristics.stationaryAttackBonus;
             }
            this.attackCooldown = max(15, floor(cooldown)); // 弓兵冷卻可以稍長一點

            this.state = 'attacking'; // 保持攻擊狀態直到冷卻結束
            // 注意：傷害由箭矢的 checkHit() 觸發，這裡不直接調用 takeDamage

        } else {
            // --- 近戰單位：直接造成傷害 ---
            target.takeDamage(damage, this.type);
            createDamageText(target.x + random(-this.size/2, this.size/2), target.y - this.size, damage, color(255, 0, 0));

            // 創建近戰攻擊視覺效果
            battleState.battlefieldEffects.push({
                type: 'attack_line', x: this.x, y: this.y, tx: target.x, ty: target.y,
                duration: 10, initialDuration: 10, color: this.color, radius: 0
            });

             // 設置近戰攻擊冷卻
             let cooldown = BASE_ATTACK_COOLDOWN / (this.speed / BASE_MOVE_SPEED);
             this.attackCooldown = max(10, floor(cooldown));
              this.state = 'attacking';
        }
    }

    // --- 計算傷害 ---
    calculateDamage(target) {
        let baseDamage = this.attack * this.currentAttackMultiplier;
        let targetDefense = target.defense * target.currentDefenseMultiplier;

        // 1. 兵種相剋加成
        let typeMultiplier = 1.0;
        if (this.type === 'SPEARMAN' && target.type === 'CAVALRY' && this.characteristics.vsCavalryBonus) {
            typeMultiplier = this.characteristics.vsCavalryBonus;
        }
         if (this.type === 'CAVALRY' && target.type === 'SPEARMAN') { // 騎兵打槍兵劣勢
             typeMultiplier = 0.7;
         }
         if (this.type === 'ARCHER' && target.type === 'SHIELDMAN' && target.characteristics.vsArcherResist) { // 弓兵打盾兵效果差
             typeMultiplier /= target.characteristics.vsArcherResist; // 除以抵抗值
         }


        // 2. 騎兵衝鋒加成
        let chargeBonus = 1.0;
        if (this.type === 'CAVALRY' && this.chargeTimer === 0 && this.state === 'moving' && this.characteristics.chargeBonus) {
             // 判斷是否剛接觸敵人 (可以通過狀態切換或距離判斷)
             // 簡化：只要冷卻好了且在移動中攻擊就有加成
             chargeBonus = this.characteristics.chargeBonus;
             this.chargeTimer = this.characteristics.chargeCooldown; // 設置衝鋒冷卻
             console.log("Cavalry Charge!");
              // 衝鋒特效
              createBattlefieldEffect('self_buff', this.x, this.y, this.size * 1.5, 20, color(255,50,50, 150), this, 'charge');
         }

        // 3. 弓兵原地加成 (已在攻擊冷卻中考慮，這裡不再乘)
        let stationaryBonus = 1.0;
        // if (this.type === 'ARCHER' && this.stationaryTimer > 120 && this.characteristics.stationaryAttackBonus) {
        //     stationaryBonus = this.characteristics.stationaryAttackBonus;
        // }


        // 4. 防守方城防加成 (應用於攻擊方承受的傷害，或降低攻擊方造成的傷害)
        let cityDefenseFactor = 1.0;
         if (!this.isAttackerSide && battleState.defender.cityDefenseBonus) {
             // 城防越高，受到的傷害越低 (減傷比例)
             cityDefenseFactor = 1.0 - (battleState.defender.cityDefenseBonus / 200); // 例如100防禦減傷50%
             cityDefenseFactor = max(0.1, cityDefenseFactor); // 最多減傷90%
         }

        // 5. 基礎傷害計算 (考慮攻防差)
        // 方案 A: 簡單減法
        // let calculatedDamage = baseDamage * typeMultiplier * chargeBonus * stationaryBonus - targetDefense;
        // 方案 B: 比例減傷 (常用)
        // 減傷率 = 防禦 / (防禦 + K)，K 是常數，例如 100
        let damageReduction = targetDefense / (targetDefense + 100);
        let calculatedDamage = baseDamage * typeMultiplier * chargeBonus * stationaryBonus * (1 - damageReduction);


        // 應用城防影響 (直接降低最終傷害)
         calculatedDamage *= cityDefenseFactor;

         // 6. 加入隨機浮動
         calculatedDamage *= random(0.85, 1.15);

        // 確保最低傷害為 1
        return floor(max(1, calculatedDamage));
    }

    // --- 承受傷害 ---
    takeDamage(amount, sourceType = 'unknown') {
        if (this.hp <= 0 || this.state === 'dying' || this.state === 'dead') return; // 已經死了或正在死

        // 應用防禦 (已在 calculateDamage 中考慮)
        let actualDamage = amount; // 傳入的已經是計算後的傷害

        this.hp -= actualDamage;
        this.hp = max(0, this.hp); // 不能為負
        this.hitTimer = 10;

        // 處理反傷效果
        if (this.currentDamageReflect > 0 && sourceType !== 'reflect' && this.target && this.target.hp > 0) {
             let reflectDamage = floor(actualDamage * this.currentDamageReflect);
             if (reflectDamage > 0) {
                 this.target.takeDamage(reflectDamage, 'reflect'); // 標記為反傷，避免無限循環
                 createDamageText(this.target.x, this.target.y, reflectDamage, color(180, 180, 180)); // 反傷灰色
             }
        }


        if (this.hp <= 0) {
            this.state = 'dying';
             this.deathTimer = 30; // 死亡動畫時間
             this.target = null;
             this.moveTargetPos = null;
            // 播放死亡動畫/音效等
        }
    }

    // --- 應用效果 ---
    applyEffect(name, type, value, duration) {
         // 檢查是否已有同名效果，如果有則刷新持續時間 (或疊加，看設計)
         const existingEffectIndex = this.effects.findIndex(e => e.name === name);
         if (existingEffectIndex !== -1) {
             this.effects[existingEffectIndex].duration = max(this.effects[existingEffectIndex].duration, duration); // 取較長的持續時間
             this.effects[existingEffectIndex].value = value; // 更新效果值 (如果需要)
       //      console.log(`Refreshed effect: ${name} on unit ${this.id}`);
         } else {
            this.effects.push({ name, type, value, duration });
       //     console.log(`Applied effect: ${name} (${type}: ${value}, ${duration}f) to unit ${this.id}`);
         }
        this.recalculateEffectMultipliers(); // 添加效果後重新計算總乘數
    }

     // --- 移除效果 ---
    removeEffect(name) {
        const initialLength = this.effects.length;
        this.effects = this.effects.filter(effect => effect.name !== name);
        if (this.effects.length < initialLength) {
          //  console.log(`Removed effect: ${name} from unit ${this.id}`);
            this.recalculateEffectMultipliers(); // 移除效果後重新計算
        }
    }


    // --- 更新效果持續時間並移除過期效果 ---
    updateEffects() {
        let needsRecalculation = false;
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].duration--;
            if (this.effects[i].duration <= 0) {
                console.log(`Effect expired: ${this.effects[i].name} on unit ${this.id}`);
                this.effects.splice(i, 1);
                needsRecalculation = true;
            }
        }
        if (needsRecalculation) {
            this.recalculateEffectMultipliers();
        }
    }

    // --- 重新計算當前總效果乘數 ---
    recalculateEffectMultipliers() {
        // 重置為基礎值
        this.currentAttackMultiplier = 1.0;
        this.currentDefenseMultiplier = 1.0;
        this.currentSpeedMultiplier = 1.0;
        this.currentDamageReflect = 0;

        // 疊加所有效果
        this.effects.forEach(effect => {
            switch (effect.type) {
                case 'attack_multiplier':
                    this.currentAttackMultiplier *= effect.value;
                    break;
                case 'defense_multiplier':
                    this.currentDefenseMultiplier *= effect.value;
                    break;
                case 'speed_multiplier':
                    this.currentSpeedMultiplier *= effect.value;
                    break;
                 case 'damage_reflect':
                     this.currentDamageReflect += effect.value; // 反傷效果疊加
                     break;
                // 可以添加其他效果類型，如 'flat_attack_bonus', 'heal_over_time' 等
            }
        });
         // 防止乘數為負或過低
         this.currentAttackMultiplier = max(0.1, this.currentAttackMultiplier);
         this.currentDefenseMultiplier = max(0.1, this.currentDefenseMultiplier);
         this.currentSpeedMultiplier = max(0.1, this.currentSpeedMultiplier);
         this.currentDamageReflect = max(0, this.currentDamageReflect);
    }

     // --- 應用玩家指令 ---
     applyPlayerCommand() {
         // 移除舊指令效果 (如果有的話)
         this.removeEffect('player_command_charge_atk');
         this.removeEffect('player_command_charge_def');
         this.removeEffect('player_command_defend_atk');
         this.removeEffect('player_command_defend_def');

         let command = battleState.playerCommand;
         let isPlayerControlled = (this.isAttackerSide && battleState.attacker.factionId === PLAYER_FACTION_ID) ||
                                  (!this.isAttackerSide && battleState.defender.factionId === PLAYER_FACTION_ID);

         if (isPlayerControlled && command) {
             switch (command) {
                 case 'charge':
                      // 突擊：攻+30%，防-20%
                     this.applyEffect('player_command_charge_atk', 'attack_multiplier', 1.3, 5); // 短暫效果，每幀更新
                     this.applyEffect('player_command_charge_def', 'defense_multiplier', 0.8, 5);
                     break;
                 case 'defend':
                      // 防守：攻-20%，防+40%
                     this.applyEffect('player_command_defend_atk', 'attack_multiplier', 0.8, 5);
                     this.applyEffect('player_command_defend_def', 'defense_multiplier', 1.4, 5);
                     break;
                 case 'standard':
                      // 標準：移除加成/懲罰 (已在開頭移除)
                     break;
                 // 可以添加更多指令，如 'retreat' (改變移動目標和速度)
             }
         }
     }


    // --- 限制單位位置 ---
    constrainPosition() {
         const margin = this.size / 2;
         // 頂部邊界 (考慮血條)
         const topBound = barY + barHeight + margin + 10;
         // 底部邊界 (考慮武將區)
         const bottomBound = BATTLE_AREA_HEIGHT - 70 - margin; // 留出更多空間給武將UI
         const leftBound = margin;
         const rightBound = width - margin;

         this.x = constrain(this.x, leftBound, rightBound);
         this.y = constrain(this.y, topBound, bottomBound);
    }


    // --- 繪製單位 ---
    draw() {
        push(); // 保存繪圖狀態
        let bob = 0;
        if (this.state === 'moving' || this.state === 'attacking') {
            bob = sin(frameCount * 0.2 + this.animationOffset) * 2;
        }
        translate(this.x, this.y + bob);
        scale(this.isAttackerSide ? 1 : -1, 1); // 讓防守方朝左

        // 根據受擊閃紅
        let bodyColor = this.hitTimer > 0 ? lerpColor(this.color, color(255,0,0), 0.6) : this.color;
        fill(bodyColor);
        noStroke();

         // 死亡動畫：逐漸變灰/透明
         if (this.state === 'dying') {
             let deathProgress = 1 - this.deathTimer / 30; // 0 -> 1
             let grayColor = lerpColor(this.color, color(50), deathProgress); // 變灰
             let alphaValue = lerp(255, 0, deathProgress); // 變透明
             fill(red(grayColor), green(grayColor), blue(grayColor), alphaValue);
             // 可以加點粒子效果
              if(random() < 0.3){
                  fill(200, alphaValue * 0.5);
                  ellipse(random(-this.size/2, this.size/2), random(-this.size/2, this.size/2), 2, 2);
              }
         } else if (this.state === 'dead') {
             pop(); // 死透了就不畫了
             return;
         }


         // 繪製不同形狀代表兵種
        switch(this.shape) {
            case 'triangle':
                // 繪製朝前的三角形 (槍兵)
                 rotate(this.isAttackerSide ? PI/2 : -PI/2); // 指向敵人方向
                 beginShape();
                 vertex(0, -this.size * 0.8);
                 vertex(-this.size * 0.5, this.size * 0.5);
                 vertex(this.size * 0.5, this.size * 0.5);
                 endShape(CLOSE);
                 rotate(this.isAttackerSide ? -PI/2 : PI/2); // 轉回來
                break;
            case 'rect':
                 // 繪製矩形 (盾兵)
                 rectMode(CENTER);
                rect(0, 0, this.size, this.size * 1.2); // 稍微高一點
                break;
            case 'ellipse':
                 // 繪製橢圓 (騎兵/弓兵)
                 ellipse(0, 0, this.size * (this.type === 'CAVALRY' ? 1.3 : 1), this.size); // 騎兵寬一點
                break;
            default:
                ellipse(0, 0, this.size, this.size);
        }

        // 簡易人物線條
        stroke(0);
        strokeWeight(2);
        noFill();
        let h = this.size;
        let head = this.size * 0.4;
        let swing = sin(this.animCounter * 0.25);
        let armA = 0;
        let legA = 0;
        if (this.state === 'moving') {
            armA = PI/6 * swing;
            legA = PI/6 * swing;
        } else if (this.state === 'attacking') {
            armA = -PI/2;
        }
        line(0, -h*0.1, 0, h*0.3); // 身體
        ellipse(0, -h*0.3, head, head); // 頭
        let armL = h*0.3;
        line(0, 0, armL*cos(armA), armL*sin(armA));
        line(0, 0, armL*cos(-armA), armL*sin(-armA));
        let legL = h*0.4;
        line(0, h*0.3, legL*sin(legA), h*0.3 + legL*cos(legA));
        line(0, h*0.3, -legL*sin(legA), h*0.3 + legL*cos(legA));

        // --- 繪製 HP 條 ---
        if (this.hp > 0 && this.state !== 'dying') {
            let hpRatio = this.hp / this.maxHp;
            let hpBarWidth = this.size * 1.5;
            let hpBarHeight = 4;
            let hpBarY = -this.size * 0.8 - hpBarHeight; // 在單位上方

            rectMode(CORNER);
            // HP Bar 背景
            fill(50, 50, 50, 180);
            rect(-hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight, 1);
            // HP Bar 前景
             let hpColor = lerpColor(color(255, 0, 0), color(0, 255, 0), hpRatio); // 紅到綠
            fill(hpColor);
            rect(-hpBarWidth / 2, hpBarY, hpBarWidth * hpRatio, hpBarHeight, 1);
        }

         // --- 繪製效果指示器 (例如中毒、燃燒、Buff) ---
         let effectIconY = this.size * 0.8; // 在單位下方
         let effectIconSize = 4;
         let effectIconXOffset = - (this.effects.length - 1) * (effectIconSize + 1) / 2; // 讓圖標居中

         this.effects.forEach((effect, index) => {
             let iconColor = color(255); // 默認白色
             if (effect.type.includes('buff')) iconColor = color(0, 255, 255); // Buff 青色
             if (effect.type.includes('debuff')) iconColor = color(255, 0, 255); // Debuff 紫色
              if (effect.name.includes('charge')) iconColor = color(255,100,0); // 衝鋒橘色
              if (effect.name.includes('reflect')) iconColor = color(200); // 反傷灰色

             fill(iconColor);
             ellipse(effectIconXOffset + index * (effectIconSize + 1), effectIconY, effectIconSize, effectIconSize);
         });


        pop(); // 恢復繪圖狀態
    }
	
	
}
