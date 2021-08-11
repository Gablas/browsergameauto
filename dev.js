const puppeteer = require("puppeteer");
const secret = require("./secret");

const mode = "dev";

const opts = {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true ? mode == "prod" : false,
    defaultViewport: null,
    slowMo: 500 ? mode == "prod" : 100,
};

const baseSelector =
    "#main_pages > div.main_left > div > div:nth-child(4) > div.box_main_style.baseDiv > table > tbody > tr > td > span > a";

const upgradeSelector =
    "#building_content > table:nth-child(2) > tbody > tr > td:nth-child(2) > div:nth-child(5) > a";

const oilSourceRef =
    "#main_content > div.main_right > div:nth-child(6) > div:nth-child(20)";

const pump1Selector = "#oilWell1 > a";

const pump2Selector = "#buildingsBox > div:nth-child(21) > a";

const oilRefSelector = "#oilRefinery";

let tUFA = 0;
let tUFM = 0;

async function getAllElements(page) {
    const k = {};

    const x = await page.$$(".clickableBuilding");

    for (let i = 0; i < x.length; i++) {
        let l = await x[i].getProperty("title");
        l = await l.jsonValue();

        let name = l.split(" ")[0];

        if (k[name] == null) k[name] = x[i];
        else k[name + "2"] = x[i];
    }

    return k;
}

async function sell(page, username) {
    let oilSource = false;
    try {
        await page.waitForSelector("#oilRefinery", { timeout: 15000 });
    } catch (e) {
        oilSource = true;
    }

    let y = await page.$(
        "#main_pages > div.main_left > div > div:nth-child(2) > div > table:nth-child(4) > tbody > tr:nth-child(3) > td > script"
    );

    y = await y.getProperty("innerHTML");

    y = await y.jsonValue();

    y = y
        .toString()
        .trim()
        .replace("res_count", "")
        .replace("(", "")
        .replace(")", "")
        .replace(";", "")
        .split(",");

    let current = y[0];

    let total = 9540; //y[2];

    y = await page.$(
        "#main_pages > div.main_left > div > div:nth-child(2) > div > table:nth-child(4) > tbody > tr:nth-child(4) > td"
    );

    y = await y.getProperty("innerHTML");

    y = await y.jsonValue();

    y = parseInt(
        y
            .toString()
            .trim()
            .replace("<b>Produktion: </b>", "")
            .replace(" liter/h", "")
    );

    let rate = y;

    if (!oilSource) {
        await page.click("#oilRefinery");
    } else {
        await page.click(oilSourceRef);
    }

    await page.waitForSelector("input[value='60']");

    let x = await page.$("input[value='60']");

    x = await x.getProperty("disabled");

    if (x._remoteObject.value == false) {
        console.log("Selling for " + username);

        current = 0;

        await page.waitForSelector("input[value='60']");

        await page.click("input[value='60']");

        await page.click("input[value='Sälj!']");
    }

    try {
        // Closes the menu
        await page.click("#menubase");
    } catch (e) {}

    let timeUntilFull = (total - current) / rate;

    timeUntilFull = Math.ceil(timeUntilFull * 3600000) + 10000;

    return timeUntilFull;
}

async function upgrade(page, building) {
    try {
        console.log("Upgrade: " + building);
        await page.waitForSelector(building);

        await page.click(building);

        await page.waitForTimeout(1000);

        await page
            .waitForSelector(upgradeSelector, { timeout: 10000 })
            .catch((e) => e);

        await page.click(upgradeSelector).catch((e) => e);

        await page.waitForTimeout(1000);

        // Closes the menu
        await page.click("#menubase");

        await page.waitForTimeout(1000);
    } catch (e) {}
}

async function main(username, password) {
    console.log("running profile: " + username);

    const browser = await puppeteer.launch(opts);
    const page = await browser.newPage();
    await page.goto("http://classic.rivality.se");

    await page.waitForSelector("input[name='logUsername']");

    await page.$eval(
        "input[name='logUsername']",
        (el, username) => (el.value = username),
        username
    );

    await page.$eval(
        "input[name='logPassword']",
        (el, password) => (el.value = password),
        password
    );

    await page.waitForSelector("input[value='Logga in']");

    await page.click("input[value='Logga in']");

    await page.waitForSelector(".box_top_text");

    await page.click(".menu_base");

    await page.waitForSelector(".baseDrop");

    await page.click(".baseDrop");

    await page.waitForTimeout(4000);

    const p = await page.$$eval(baseSelector, (anchors) =>
        [].map.call(anchors, (a) => a.href)
    );

    getAllElements(page);

    return;

    let k = 60000; // one min if fail
    try {
        k = await sell(page, username);
    } catch (e) {}

    if (username == "massaxe") {
        await upgrade(page, pump1Selector);
        await upgrade(page, pump2Selector);
        await upgrade(page, oilRefSelector);
    }

    if (p.length > 0) {
        for (let i = 0; i < p.length; i++) {
            await page.goto(p[i]);
            let h = 60000; // one min if fail
            try {
                h = await sell(page, username);
                if (username == "massaxe") {
                    await upgrade(page, pump1Selector);
                    await upgrade(page, pump2Selector);
                    await upgrade(page, oilRefSelector);
                }
            } catch (e) {}

            if (h < k) {
                k = h;
            }
        }
    }

    setTimeout(() => {
        main(username, password);
    }, k);

    k = k / 1000 / 60;

    console.log("Will run " + username + " again in: " + k + " minutes");

    setTimeout(() => {
        browser.close();
    }, 5000);
}

function ride() {
    for (let i = 0; i < secret.users.length; i++) {
        main(secret.users[i].username, secret.users[i].password);
    }
}

if (mode == "prod") {
    ride();
} else {
    main(secret.users[0].username, secret.users[0].password);
}
