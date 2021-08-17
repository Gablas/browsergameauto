const puppeteer = require("puppeteer");
const secret = require("./secret");

const mode = "prod";

let selectors = null;

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

const baseNameSelector = "#main_content > div.main_right > h1";

async function getName(page) {
    let y = "";
    try {
        await page.waitForSelector(baseNameSelector);

        y = await page.$(baseNameSelector);

        y = await y.getProperty("innerHTML");

        y = await y.jsonValue();
    } catch (e) {
        console.error(e);
    }

    return y;
}

async function sell(page, username) {
    console.log("Kör sälj för " + username);
    let oilSource = false;
    try {
        await page.waitForSelector("#oilRefinery", { timeout: 15000 });
    } catch (e) {
        oilSource = true;
        //console.error(e);
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

    await page.waitForTimeout(10000);

    //await page.waitForSelector("input[value='60']");

    await page.waitForSelector("input[value='Sälj!']");

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

async function upgrade(page, building, element = false) {
    try {
        console.log("Upgrade: " + building);
        if (!element) {
            await page.waitForSelector(building);

            await page.click(building);
        } else {
            await building.click();
        }

        await page.waitForTimeout(1000);

        await page
            .waitForSelector(upgradeSelector, { timeout: 10000 })
            .catch((e) => e);

        await page.click(upgradeSelector).catch((e) => e);

        await page.waitForTimeout(1000);

        // Closes the menu
        await page.click("#menubase");

        await page.waitForTimeout(1000);
    } catch (e) {
        console.error(e);
    }
    return null;
}

async function getAllElements(page) {
    const k = {};

    const x = await page.$$(".clickableBuilding");

    for (let i = 0; i < x.length; i++) {
        let l = await x[i].getProperty("title");
        l = await l.jsonValue();

        let name = l.split(" ")[0];
        let level = parseInt(l.split(" ")[2]);
        let object = {lvl: level, obj: x[i]};

        if (k[name] == null)
            k[name] = object;
        else if (k[name + "2"] == null)
            k[name + "2"] = object;
        else
            k[name + "3"] = object;
    }

    return k;
}

async function login(page, username, password) {
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

    return;
}

async function main(username, password) {
    console.log("running profile: " + username);

    const browser = await puppeteer.launch(opts);
    const page = await browser.newPage();
    await page.goto("http://classic.rivality.se");

    await login(page, username, password);

    await page.waitForSelector(".baseDrop");

    await page.click(".baseDrop");

    await page.waitForTimeout(4000);

    const p = await page.$$eval(baseSelector, (anchors) =>
        [].map.call(anchors, (a) => a.href)
    );

    p.unshift("http://classic.rivality.se/?p=base");

    console.log(p);

    let k = 99999999999999;

    if (p.length > 0) {
        for (let i = 0; i < p.length; i++) {
            await page.goto(p[i]);
            let name = await getName(page);
            selectors = await getAllElements(page);
            let h = 1800000; // Min wait if fail
            try {
                console.log("Kör all för bas: " + name);
                if (!name.includes("Olje")) {
                    console.log("uppgraderar");
                    await upgrade(page, selectors["Oljepump"]["obj"], true);
                    selectors = await getAllElements(page);
                    await upgrade(page, selectors["Oljepump2"]["obj"], true);
                    selectors = await getAllElements(page);
                    await upgrade(page, selectors["Oljeraffinaderi"]["obj"], true);
                    selectors = await getAllElements(page);
                    
                    for (let i = 0; i < 3; i++) {
                        let barName = i > 0 ? "Barrack" + i : "Barrack";
                        let fabName = i > 0 ? "Fabrik" + i : "Fabrik";
                        let akaName = i > 0 ? "Akademi" + i : "Akademi";
                        let upgNames = [barName, fabName, akaName];
                        upgNames.forEach(upgName => {
                            if (selectors[upgName] != null) {
                                if (selectors[upgName]["lvl"] > 1) {
                                    await upgrade(page, selectors[upgName]["obj"], true);
                                    selectors = await getAllElements(page);
                                }
                            }
                        });
                    }
                } else {
                    console.log("uppgraderar inte");
                }
                h = await sell(page, username);
            } catch (e) {
                console.log(e);
            }

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
    main(secret.users[1].username, secret.users[1].password);
}