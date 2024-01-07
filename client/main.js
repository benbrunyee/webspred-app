const { app, BrowserWindow, ipcMain, Notification } = require("electron");
let { Builder, By, Key, until } = require("selenium-webdriver");
const path = require("path");
const { google } = require("googleapis");
const MailComposer = require("nodemailer/lib/mail-composer");
const { Store, ScreenshotStore } = require("./Store");
const GetWebsiteInfo = require("./src/scripts/getLeadsElectron").GetWebsiteInfo;
const dotenv = require("dotenv");

dotenv.config();

// Google Config
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("No Google API credentials found.");
}

const store = new Store({
  configName: "app-data", // We'll call our data "app-data"
  defaults: {
    token: "",
    tokenCreationTime: "",
    GoogleBotLock: "",
  },
});

const screenshotStore = new ScreenshotStore();

const createWindow = () => {
  let win = new BrowserWindow({
    icon: "public/icon.ico",
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    title: "Webspred App",
    show: false,
  });

  win.on("closed", () => (win = null));

  win.on("page-title-updated", (e) => {
    e.preventDefault(); // Don't allow the title to change
  });

  win.on("ready-to-show", () => {
    win.show();
    win.maximize();
  });

  const dev = Boolean(process.env.ELECTRON_START_URL);
  if (dev) {
    // Dev options
    win.webContents.openDevTools();

    require("electron-reloader")(module);
  }

  const url =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, "build/index.html")}`;
  win.loadURL(url, { userAgent: "Chrome" });

  // Listen for redirects
  win.webContents.on("will-redirect", async (e, redir) => {
    // If the redirect url is the google auth one
    if (redir.includes("http://localhost/google-auth")) {
      e.preventDefault(); // Prevent the redirect

      // Extract the token from the url
      const token = (redir.match(/access_token=(.*?)&/) || [])[1];

      // If the token exists
      if (token) {
        try {
          // Write the token to a file using json
          store.set("token", { token, createdAt: new Date() });
          new Notification({
            title: "Success.",
            body: "Successfully authorized Google account.",
          }).show();
        } catch (e) {
          console.warn(e);
          new Notification({
            title: "An error occured.",
            body: "Failed to authorize Google account.",
          }).show();
        }
      } else {
        // No token could be found (alert using platform)
        console.warn("No code found. Could not authorize user.");
        console.warn(`Redirect URL: ${redir}`);
        new Notification({
          title: "An error occured.",
          body: "Failed to authorize Google account.",
          silent: true,
        });
      }

      win.loadURL(url); // Load the homepage again
    }
  });
};

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle(
  "getSemrushData",
  async (event, { returnData, domains, googleToken }) => {
    /*
    returnData
  */
    let driver;

    // Create the data object from the domain names
    /*
      For every data object that is being asked for, we will create a key
      for the domain initially containing a false value or the actual
      gathered data value.
    */
    const data = domains.reduce((r, domain) => {
      // Create an key for every domain
      r[domain] = returnData.reduce((r, key) => {
        r[key] = false; // Create a value for every key which will be assigned to the domain
        return r;
      }, {});

      return r;
    }, {});

    // Define the functions for each available data object that can be gathered
    const functions = {
      screenshot: async (driver, domain) => {
        let screenshot = await driver.takeScreenshot();
        const fileName = domain.replace(/\..*/, "");

        try {
          // Format for a file so we can save it to a file
          screenshot = screenshot.replace(/^data:image\/png;base64/, "");
          screenshotStore.set(fileName, screenshot);
        } catch (e) {
          console.warn(e);
          console.warn("Failed to save screenshot");
          return false;
        }

        return path.join(screenshotStore.path, `${fileName}.png`);
      },
      authority_score: async (driver) => {
        // The element for the authority score
        const authority_score_xpath =
          '//div[contains(@class, "mainNumber")]/a[contains(@href, "analytics/backlinks/overview")]/span';

        try {
          await driver.wait(
            until.elementLocated(By.xpath(authority_score_xpath)),
            2000
          );
        } catch (e) {
          console.warn(e);
          console.warn("Failed to find authority score");
          return false;
        }

        try {
          const authority_score_elem = await driver.findElement(
            By.xpath(authority_score_xpath)
          );
          return await authority_score_elem.getText();
        } catch (e) {
          console.warn(e);
          console.warn("Failed to get value for authority score");
          return false;
        }
      },
      organic_search_traffic: async (driver) => {
        // The element for the organic search traffic
        const organic_search_traffic_xpath =
          '//div[contains(@class, "mainNumber")]/a[contains(@href, "analytics/organic/positions")]/span';

        try {
          await driver.wait(
            until.elementLocated(By.xpath(organic_search_traffic_xpath)),
            2000
          );
        } catch (e) {
          console.warn(e);
          console.warn("Failed to find organic search traffic");
          return false;
        }

        try {
          const organic_search_traffic_elem = await driver.findElement(
            By.xpath(organic_search_traffic_xpath)
          );
          return await organic_search_traffic_elem.getText();
        } catch (e) {
          console.warn(e);
          console.warn("Failed to get value for organic search traffic");
          return false;
        }
      },
    };

    try {
      driver = await new Builder().forBrowser("chrome").build(); // Create the driver
      driver.manage().window().maximize(); // Maximise the window
    } catch (e) {
      console.warn(e);
      return {
        status: false,
        message: "Could not load Chrome, udpate Chromedriver.",
        error: e,
      };
    }

    try {
      // Get semrush
      await driver.get("https://www.semrush.com/login/");

      // Login
      await sendKeys(
        await driver.findElement(By.xpath('//input[@type="email"]')),
        "ben@webspred.com"
      );
      await sendKeys(
        await driver.findElement(By.xpath('//input[@type="password"]')),
        "@webspred12",
        Key.RETURN
      );
    } catch (e) {
      console.warn(e);
      await driver.quit();
      return {
        status: false,
        message: "Failed to login to semrush",
        error: e,
      };
    }

    // Wait for the home page to load - We have signed in
    try {
      await driver.wait(
        until.elementLocated(
          By.xpath('//input[@role="combobox" and @type="search"]')
        ),
        3000
      );
    } catch (e) {
      console.warn(
        "We have not logged in, either credentials are wrong or we have a captcha to complete"
      );

      while (true) {
        await new Promise((resolve) => setTimeout(() => resolve(), 5000)); // Wait 5 seconds

        try {
          // Try search for the element again
          await driver.wait(
            until.elementLocated(
              By.xpath('//input[@role="combobox" and @type="search"]')
            ),
            3000
          );

          break; // If found then no error would be thrown and we can exit
        } catch (e) {
          console.warn("Still not logged in");
        }
      }
    }

    // For every domain we want to get the screenshot for
    for (let domain of domains) {
      try {
        // Search for the domain
        /*
        Calling the URL will automatically wait for the page to finish loading.
        However, not all the data will be displayed as there is JavaScript being
        executed which updates the display varibles.
      */
        await driver.get(
          `https://www.semrush.com/analytics/overview/?searchType=domain&q=${domain}`
        );

        while (true) {
          // Wait 1 second and check again
          await new Promise((resolve) => setTimeout(() => resolve(), 1000));

          // These are the main number loading elements.
          // If these are still present then the page is still loading.
          const rects = await driver.findElements(
            By.xpath('//div[contains(@style, "mainNumber")]/svg/rect')
          );

          if (Array.isArray(rects) && rects.length > 0) {
            console.log("Page is still loading");
          } else if (Array.isArray(rects) && rects.length === 0) {
            // It has finished loading now
            break;
          } else {
            // Could not find any elements
            break;
          }
        }

        // Wait 2 seconds for all elements to display data

        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 2000);
        });

        // For every return value specified, call the appropriate function
        for (let key of returnData) {
          if (Object.keys(functions).includes(key)) {
            data[domain][key] = await functions[key](driver, domain);
          } else {
            console.warn("Invalid data type requested");
          }
        }
      } catch (e) {
        console.warn(e);
        return {
          status: false,
          message: `Failed to get data on ${domain}`,
          error: e,
        };
      }
    }

    await driver.quit();

    return {
      status: true,
      message: "success",
      data: data,
    };
  }
);

// Function to send keys more like a human with mistakes and time delays
async function sendKeys(element, keys, ...args) {
  const keysArr = [...keys.split(""), ...args];
  const multiplier = 200; // Maximum of 200ms delay between keys

  let i = 1;
  for (let key of keysArr) {
    // If the character is actually a string
    if (typeof key === "string" && i !== keysArr.length) {
      const makeMistake = Math.random() > 0.9; // 10% chance to make a mistake

      if (makeMistake) {
        // Select the next ascii character and input it
        await element.sendKeys(String.fromCharCode(key.charCodeAt(0) + 1));

        // Wait for a small amount of time
        await new Promise((resolve) =>
          setTimeout(() => resolve(), Math.random() * multiplier)
        );

        // Delete the mistake
        await element.sendKeys(Key.BACK_SPACE);

        // Wait for a small amount of time
        await new Promise((resolve) =>
          setTimeout(() => resolve(), Math.random() * multiplier)
        );
      }
    }

    await element.sendKeys(key); // Send key by key

    // Wait for a small amount of time
    await new Promise((resolve) =>
      setTimeout(() => resolve(), Math.random() * multiplier)
    );

    i++;
  }
}

/**
 * Emails var to be in the form of an array containing all the information
 * needed for the email. Each var within the email object should have a fallback
 * option except from the basic to and from vars.
 *
 * @param {string} token - The access token of the current user. Obtained through google oauth2.
 * @param {array} emails - Array containing objects containing information that is stated in the for loop.
 */
ipcMain.handle("createDrafts", async (event, { token, emails }) => {
  if (emails.length === 0) {
    // If no emails were provided
    return {
      status: true,
      message: "No emails provided",
      drafts: [],
    };
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);

  oauth2Client.setCredentials({ access_token: token });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Set the return object
  const result = {
    status: true,
    message: "",
    drafts: [],
  };

  // For every email object we will create a draft
  for (let { sender, subject, html, to, attachments } of emails) {
    // Create the email with the params provided
    const mail = new MailComposer({
      from: sender,
      sender,
      to,
      replyTo: "contact@webspred.com",
      subject,
      html,
      ...(Array.isArray(attachments) && {
        attachments,
      }),
      textEncoding: "base64", // Keep this the same for Gmail
    });

    let raw;
    try {
      // Wait for the message to be built
      raw = await new Promise((resolve, reject) => {
        mail.compile().build((err, message) => {
          if (err) {
            reject(err);
          } else {
            // Encode as base64 as Gmail will decode with base64
            resolve(Buffer.from(String(message)).toString("base64"));
          }
        });
      });

      if (!raw) {
        throw new Error("Could not create email.");
      }
    } catch (error) {
      // Log the error and add the failure to the drafts object
      console.warn(error);
      result.drafts.push({ to, status: false, error });
      continue;
    }

    try {
      // Create the draft
      await gmail.users.drafts.create({
        userId: "me", // Special variable for the current authenticated user
        requestBody: {
          message: {
            raw: raw, // Set the message body using the base64 encoded MIME type
          },
        },
      });
    } catch (error) {
      // Log the error and add the failure to the drafts object
      console.warn(error);
      result.drafts.push({ to, status: false, error });
      continue;
    }

    result.drafts.push({ to, status: true });
  }

  // Count the number of successfully created drafts
  const successCount = result.drafts.reduce((r, v) => {
    if (v.status) {
      r++; // Increment the value
    }
    return r;
  }, 0);

  // Set the appropriate message depending on how many got sent.
  if (successCount === 0) {
    result.status = false; // Set the status to false as we have not accomplished anything
    result.message = "Failed to create all drafts.";
  } else {
    result.message = `Successfully created ${successCount}/${result.drafts.length} drafts.`;
  }

  return result;
});

/**
 * Gets a list of all domains logged in both Google sheets.
 * @param {class} sheets - The Google Sheets API class.
 */
async function getLoggedLeads(sheets) {
  const usedLeadSpredId = "1vOf2e9ZVCzDMxgksjJe0XNBRxPk8Ccz-3AZt23GZLD0";
  const leadSpredId = "1_0XlG1KEYESxm9sWMhwJ4kbWKRCAlSAS2qT1K3YS8ZE";

  const usedLeads = (
    await sheets.spreadsheets.values.get({
      spreadsheetId: usedLeadSpredId,
      range: "Sheet1!A2:A", // Only get the domain column
    })
  ).data.values;

  const loggedLeads = (
    await sheets.spreadsheets.values.get({
      spreadsheetId: leadSpredId,
      range: "Sheet1!A2:A", // Only get the domain column
    })
  ).data.values;

  return [
    ...(usedLeads ? usedLeads.map((val) => val[0]) : []), // Data is returned in arrays even when specifying a single column
    ...(loggedLeads ? loggedLeads.map((val) => val[0]) : []),
  ];
}

/**
 * Auths with a token to get the Sheets class using the Google API.
 * @param {string} token - The token of the user
 */
function authGoogleSheets(token) {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ access_token: token });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  return sheets;
}

/**
 * Saves the data to the Webspred Google sheet whilst avoiding duplicates.
 * @param {array} data - An array of the data to be saved.
 * @param {string} token - The token for the user.
 */
ipcMain.handle(
  "saveToGoogleSheets",
  async (event, { spreadsheetId, data, token }) => {
    try {
      await saveToGoogle(spreadsheetId, data, token);

      return {
        status: true,
      };
    } catch (e) {
      console.warn(e);
      return {
        status: false,
      };
    }
  }
);

async function saveToGoogle(spreadsheetId, data, token, sheets) {
  sheets = sheets || authGoogleSheets(token);

  try {
    // Save the data
    await sheets.spreadsheets.values.append(
      data.reduce(
        (r, elem) => {
          r.resource.values.push(elem); // Add the values as a row
          return r;
        },
        {
          spreadsheetId,
          range: "Sheet1!A2",
          // ? Change to "OVERWRITE"?
          insertDataOption: "INSERT_ROWS",
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [],
          },
        }
      )
    );
  } catch (e) {
    console.warn(e);
    throw e;
  }

  return { status: true, message: "Successfully saved leads" };
}

ipcMain.handle("getUniqueLeads", async (event, { leads, token }) => {
  let uniqueLeads = "";

  try {
    uniqueLeads = await getUniqueLeads(leads, token);
  } catch (e) {
    console.warn(e);
  }

  return uniqueLeads;
});

/**
 *
 * @param {object} leads - Object of leads
 * @param {string} token - The token for authenticating Google sheets
 * @returns object - The new list of leads
 */
async function getUniqueLeads(leads, token) {
  const sheets = authGoogleSheets(token);

  let loggedLeads;

  try {
    // Get the existing data from the sheet
    loggedLeads = await getLoggedLeads(sheets);
  } catch (e) {
    console.warn(e);
    console.warn("Failed to get existing used leads.");
    throw e;
  }

  return Object.keys(leads).reduce((r, key) => {
    if (!loggedLeads.includes(key)) {
      r[key] = leads[key];
    }
    return r;
  }, {});
}

/**
 * Gets the token if there is one
 */
ipcMain.handle("getGoogleToken", (event, args) => {
  try {
    let data = store.get("token");
    return data; // Return the data
  } catch (e) {
    console.warn("Could not read token from file");
    console.warn(e);
    return null; // Don't return anything
  }
});

/**
 * Check google bot check lock
 */
ipcMain.handle("checkGoogleBotLock", (event, args) => {
  let lock = "GoogleBotLock";
  const lockTime = store.get(lock);

  if (!lockTime) {
    return true; // No value set
  }

  if (Date.parse(lockTime) + 60 * 60000 <= new Date().getTime()) {
    // If one hour has passed
    store.set(lock, ""); // Clear the value
    return true; // Return true to allow for searching
  } else {
    console.warn("One hour has not yet passed for Google bot lock.");
    return false; // Return false as 1 hour hasn't passed
  }
});

/**
 * Creates the google bot lock
 */
ipcMain.handle("createGoogleBotLock", (event, time) => {
  store.set("GoogleBotLock", time);
});

/**
 * Searches linkedin page by page with search terms provided by the user.
 * The data found is returned but also has the option to save to the Google Sheet
 * in the Webspred drive.
 */
ipcMain.handle(
  "getLinkedInLeads",
  async (
    event,
    {
      email,
      password,
      search,
      numOfResults,
      saveToGoogle: willSaveToGoogle,
      researchWebsite,
      token,
    }
  ) => {
    let driver;
    let sheets;

    console.debug(
      `Params (Password not included): ${JSON.stringify({
        email,
        search,
        numOfResults,
        saveToGoogle: willSaveToGoogle,
        researchWebsite,
        token,
      })}`
    );

    if (willSaveToGoogle && token) {
      console.debug("We have been instructed to save to Google.");
      console.debug(`Token was passed in: ${token}`);
      sheets = authGoogleSheets(token);
      console.debug("Successfully authed Google Sheets");
    }

    // Load LinkedIn
    try {
      console.debug("Loading LinkedIn");
      // Create the driver for the chrome browser
      driver = await new Builder().forBrowser("chrome").build();

      console.debug("Maximising window");
      // Maximise the window
      driver.manage().window().maximize();
    } catch (e) {
      console.warn(e);
      return {
        status: false,
        message: "Could not load Chrome, update Chromedriver.",
        error: e,
      };
    }

    try {
      console.debug("Loading the login page of LinkedIn.");
      // Load LinkedIn
      await driver.get("https://www.linkedin.com/login");

      console.debug(`Logging user in with email: ${email}`);

      // Login
      await sendKeys(
        await driver.findElement(By.xpath('//input[@id="username"]')),
        email
      );
      await sendKeys(
        await driver.findElement(By.xpath('//input[@id="password"]')),
        password,
        Key.RETURN
      );
    } catch (e) {
      console.warn(e);
      await driver.quit();
      return {
        status: false,
        message: "Failed to login to LinkedIn.",
        error: e,
      };
    }

    // Wait for the home page to load - we have signed in successfully
    try {
      await driver.wait(
        until.elementLocated(By.xpath('//div[@id="voyager-feed"]')),
        3000
      );

      console.debug("Home page has loaded successfully");
    } catch (e) {
      console.warn(
        "We have not logged in successfully. Possible captcha to solve?"
      );
      await waitForElement(driver, '//div[@id="voyager-feed"]', 1000, 20);
    }

    // Keep track of the data we want to return
    // { title: result }
    const data = {};

    console.debug(`Number of results requested: ${numOfResults}`);

    // While the searches performed are less than the number of searches requested
    while (Object.keys(data).length < numOfResults) {
      console.debug(
        `Data entries gathered so far: ${Object.keys(data).length}`
      );

      // Search LinkedIn with the requested page and search filters
      // Returns the driver and hrefs of results
      const searchResult = await searchLinkedIn(driver, search);

      // If the page finding was unsuccessful then just break out and return the data found so far
      if (!searchResult.status) {
        console.warn(searchResult);
        break;
      }

      driver = searchResult.driver;
      const results = searchResult.results;

      // Loop through the results
      for (let result of results) {
        // Don't do more research if we have already hit the requested amount
        if (Object.keys(data).length >= numOfResults) {
          break;
        }

        const researchPageResult = await researchLinkedInPage(driver, result);

        // If the result was unsuccessful then we just skip this website and move onto the next
        if (!researchPageResult.status) {
          continue;
        }

        driver = researchPageResult.driver;

        // Add the data to the object, use titles as the keys as we want to avoid duplicate data
        if (researchPageResult.data.title) {
          data[researchPageResult.data.title] = researchPageResult.data;
        }

        // If we have been instructed to research the website and gather information from there
        if (
          data[researchPageResult.data.title] &&
          researchWebsite &&
          researchPageResult.data.website
        ) {
          let websiteInfo;
          try {
            console.debug(
              `We are now getting the website data on: ${researchPageResult.data.website}`
            );
            websiteInfo = await GetWebsiteInfo(researchPageResult.data.website);
            console.debug(`Website info request returned: ${websiteInfo}`);
          } catch (e) {
            console.warn(e);
            console.warn(
              `Could not get website data for: ${researchPageResult.data.website}`
            );
          }

          if (websiteInfo && websiteInfo.status) {
            console.debug(
              `Successfully got data on the website: ${JSON.stringify(
                websiteInfo.body
              )}`
            );
            data[researchPageResult.data.title].websiteScrape =
              websiteInfo.body[Object.keys(websiteInfo.body)[0]];
          } else {
            console.warn(websiteInfo);
          }
        }

        // If we have been instructed to save to google then we filter out the leads and save as we go
        if (
          researchPageResult.data.title &&
          willSaveToGoogle &&
          typeof sheets !== "undefined" &&
          typeof token !== "undefined"
        ) {
          let loggedLeads;

          console.debug("Now saving data to Google as instructed");

          // If we have been instructed to save to google then we get the current logged leads
          try {
            console.debug("Getting the current logged leads");
            loggedLeads = await getLoggedLeads(sheets);
          } catch (e) {
            console.warn(e);

            // If we failed then we quit so we don't duplicate data
            return {
              status: false,
              message: "Failed to get Google leads.",
              error: e,
            };
          }

          // Check if the leads are already logged
          if (loggedLeads.includes(researchPageResult.data.title)) {
            console.debug("Company gathered has already been saved in Google");
            // If the data is already saved then move onto the next result
            continue;
          }

          console.debug(
            `This is a new company so we are going to continue to save: ${researchPageResult.data.title}`
          );

          const currentData = data[researchPageResult.data.title] || {};

          if (Object.keys(currentData).length > 0) {
            try {
              const saveToGoogleResult = await saveToGoogle(
                "1_0XlG1KEYESxm9sWMhwJ4kbWKRCAlSAS2qT1K3YS8ZE",
                // Transform the data into a nested array
                [
                  [
                    // We prioritise website data over linkedin data as this is managed more closely
                    // by a company
                    currentData.title || "N/A",
                    currentData.website || "N/A",
                    currentData.websiteScrape?.contactPage?.link || "N/A",
                    currentData.websiteScrape?.contactPage?.email || "N/A",
                    // We don't need a trailing single quote at the end, only the beginning
                    // This single quote escapes any special characters such as "+"
                    "'" +
                      (currentData.websiteScrape?.contactPage?.number ||
                        currentData.phone ||
                        "N/A"),
                    (currentData.employees || []).reduce(
                      (r, { name, jobTitle }, i, arr) => {
                        r += `${name}: ${jobTitle}`;

                        // Add a new line if not end of the array
                        if (i !== arr.length - 1) {
                          r += "\n";
                        }

                        return r;
                      },
                      ""
                    ) || "N/A",
                    currentData.websiteScrape?.facebookPage?.link || "N/A",
                    currentData.websiteScrape?.facebookPage?.pageTitle || "N/A",
                    currentData.websiteScrape?.facebookPage?.likes || "N/A",
                    currentData.websiteScrape?.facebookPage?.followers || "N/A",
                    currentData.websiteScrape?.instagramPage?.link || "N/A",
                    currentData.websiteScrape?.instagramPage?.username || "N/A",
                    currentData.websiteScrape?.instagramPage?.followers ||
                      "N/A",
                    currentData.websiteScrape?.instagramPage?.following ||
                      "N/A",
                    // Draft created
                    "N/A",
                  ],
                ],
                token,
                sheets
              );

              if (!saveToGoogleResult.status) {
                throw new Error("Failed to save to Google.");
              } else {
                console.debug(
                  `Successfully saved to google: ${researchPageResult.data.title}`
                );
              }
            } catch (e) {
              console.warn(e);
              // Quit here because we don't want to waste the user's time if it isn't saving

              return {
                status: false,
                message: "Failed to save to Google.",
                error: e,
              };
            }
          }
        } else {
          console.log("Not saving to Google.");
        }
      }
    }

    // Close the driver
    try {
      console.debug("Closing the driver");
      await driver.quit();
    } catch (e) {
      // Only log, not fail over
      console.warn(e);
    }

    console.debug(
      `Successfully got the data, returning: ${JSON.stringify(data)}`
    );

    // Return the data to the app
    return {
      status: true,
      data: Object.values(data),
    };
  }
);

/**
 *
 * @param {driver} driver - The chromedriver. Ensure it is on the search page.
 * @param {string} param - The parameter you want to modify.
 * @param {string} value - The value you want to set it to.
 * @returns driver
 */
async function applyLinkedInFilters(driver, param, value) {
  // Don't catch any errors in these functions
  const functions = {
    industry: async (driver, value) => {
      await driver.findElement(By.xpath('//button[text()="Industry"]')).click();
      console.debug("Found the industry filter");

      await waitForElement(
        driver,
        '//input[@placeholder="Add an industry"]',
        1000,
        1
      );

      // Enter the search
      await sendKeys(
        driver.findElement(By.xpath('//input[@placeholder="Add an industry"]')),
        value
      );

      // Wait 1 second for results to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sendKeys(
        driver.findElement(By.xpath('//input[@placeholder="Add an industry"]')),
        Key.ARROW_DOWN,
        Key.RETURN
      );

      await driver
        .findElement(
          By.xpath(
            '//div[@id="hoverable-outlet-industry-filter-value"]//button/*[text()="Show results"]'
          )
        )
        .click();
      console.debug("Industry filter applied successfully");

      return driver;
    },
    location: async (driver, value) => {
      await driver
        .findElement(By.xpath('//button[text()="Locations"]'))
        .click();
      console.debug("Found the locations filter");

      await waitForElement(
        driver,
        '//input[@placeholder="Add a location"]',
        1000,
        1
      );

      // Enter the search
      await sendKeys(
        driver.findElement(By.xpath('//input[@placeholder="Add a location"]')),
        value
      );

      // Wait 1 second for results to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sendKeys(
        driver.findElement(By.xpath('//input[@placeholder="Add a location"]')),
        Key.ARROW_DOWN,
        Key.RETURN
      );

      await driver
        .findElement(
          By.xpath(
            '//div[@id="hoverable-outlet-locations-filter-value"]//button/*[text()="Show results"]'
          )
        )
        .click();
      console.debug("Successfully applied locations filter");

      return driver;
    },
    companySize: async (driver, value) => {
      await driver
        .findElement(By.xpath('//button[text()="Company size"]'))
        .click();
      console.debug("Found company size filter");

      await waitForElement(
        driver,
        '//div[@id="hoverable-outlet-company-size-filter-value"]//button/*[text()="Show results"]',
        1000,
        1
      );

      await driver
        .findElement(By.xpath(`//span[text()="${value} employees"]`))
        .click();

      await driver
        .findElement(
          By.xpath(
            '//div[@id="hoverable-outlet-company-size-filter-value"]//button/*[text()="Show results"]'
          )
        )
        .click();
      console.debug(
        "Successfully applied company size filter - note that the results may not be accurate (this is due to how LinkedIn works)"
      );

      return driver;
    },
  };

  // Call the relevant function
  return await functions[param](driver, value);
}

async function waitForElement(driver, xpath, waitTime, retries) {
  let counter = 1;

  while (typeof retries !== "undefined" ? counter <= retries : true) {
    try {
      await driver.wait(
        until.elementLocated(By.xpath(xpath)),
        typeof waitTime !== "undefined" ? waitTime : 1000
      );

      console.debug(`Found element: ${xpath}`);

      // Will return if element is found as no error will be thrown
      return;
    } catch (e) {
      console.warn("Element not found: " + xpath);
    }

    console.debug("Waiting 1 second");
    await new Promise((resolve) => setTimeout(resolve, waitTime || 1000));

    counter++;
  }

  throw new Error(
    `Failed to locate element with ${retries || "unlimited"} retries.`
  );
}

/**
 * Searches LinkedIn with the search terms provided and returns a list of hrefs.
 * @param {driver} driver - The driver for Chrome.
 * @param {object} param1 - The search filters.
 * @param {number} page - Optional - The page to get the results from.
 * @returns object - { status (boolean), driver (driver), results (array) }
 */
async function searchLinkedIn(driver, { term, params, type }) {
  // First we make sure that we are on the LinkedIn home page
  try {
    console.debug("Loading LinkedIn feed page");
    await driver.get("https://www.linkedin.com/feed");
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Could not load LinkedIn homepage for search.",
      error: e,
      driver,
    };
  }

  // Search with the term
  try {
    await waitForElement(
      driver,
      '//input[contains(@class, "search-global")]',
      1000,
      5
    );

    console.debug(`Entering search term: ${term}`);

    await sendKeys(
      driver.findElement(
        By.xpath('//input[contains(@class, "search-global")]')
      ),
      term,
      Key.RETURN
    );
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Could not perform search.",
      error: e,
      driver,
    };
  }

  // Check if no results were found
  try {
    await waitForElement(driver, '//h1[text()="No results found"]', 1000, 1);

    console.debug("'No results' element was found during search");

    return {
      status: false,
      message: "No results found.",
      driver,
    };
  } catch (e) {
    // Do nothing since this is good
  }

  // Wait 3 seconds for the search to take place
  try {
    await driver.wait(
      until.elementLocated(
        By.xpath('//div[contains(@class, "entity-result")]')
      ),
      3000
    );

    console.debug("Found results with search");
  } catch (e) {
    console.warn(e);
    await waitForElement(
      driver,
      '//div[contains(@class, "entity-result")]',
      1000,
      5
    );
  }

  console.debug(`Applying the type of search: ${type}`);

  // Apply the type of search
  if (type === "PEOPLE" || type === "COMPANY") {
    try {
      await driver
        .findElement(
          By.xpath(
            type === "PEOPLE"
              ? '//button[text()="People"]'
              : '//button[text()="Companies"]'
          )
        )
        .click();
    } catch (e) {
      console.warn(e);
      return {
        status: false,
        message: "Failed to apply the type of search.",
        error: e,
        driver,
      };
    }
  } else {
    console.warn(`Not a valid search type provided: ${type}`);
  }

  // Wait for search results to load again
  try {
    await waitForElement(
      driver,
      '//div[contains(@class, "entity-result")]',
      1000,
      5
    );

    console.debug("Found results");
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Could not load results after applying type filter.",
      error: e,
      driver,
    };
  }

  console.debug(`Applying other search filters: ${JSON.stringify(params)}`);

  // Add the search filters
  for (let [param, value] of Object.entries(params)) {
    // If there is no value set then we move on
    if (!value) {
      continue;
    }

    console.debug(`Applying filter: ${param} with value: ${value}`);

    // Wait for the search params to load
    try {
      await waitForElement(
        driver,
        '//div[contains(@class, "search-reusables__filter-trigger")]',
        1000,
        5
      );

      console.debug("Filters are present");
    } catch (e) {
      console.warn(e);
      return {
        status: false,
        message: "Could not load search params.",
        error: e,
        driver,
      };
    }

    // Apply the filter
    try {
      driver = await applyLinkedInFilters(driver, param, value);
      console.debug("Filter applied");
    } catch (e) {
      console.warn(e);
      return {
        status: false,
        message: "Could not apply filters.",
        error: e,
        driver,
      };
    }
  }

  // Wait for search results to load again
  try {
    await waitForElement(
      driver,
      '//div[contains(@class, "entity-result")]',
      1000,
      5
    );
    console.debug("Results are found with applied fitler");
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Could not load results after applying type filter.",
      error: e,
      driver,
    };
  }

  let resultCount;

  // Get the total number of results
  try {
    await waitForElement(
      driver,
      '//div[@class="search-results-container"]/div[text()][1]',
      1000,
      2
    );
    console.debug("Found the number of results");

    const resultCountElem = await driver.findElement(
      By.xpath('//div[@class="search-results-container"]/div[text()][1]')
    );

    // Replace everything that is not a number
    resultCount = (await resultCountElem.getText()).replace(/[^\d]/g, "");
    console.debug(`Results for search: ${resultCount}`);

    // Page 100 is the max page LinkedIn can provide
    if (resultCount > 100) {
      console.debug("Capping results to 1000 as this is LinkedIn's limit");
      resultCount = 1000;
    }
  } catch (e) {
    console.warn(e);

    return {
      status: false,
      message: "Could not determine the number of results for the search",
      error: e,
    };
  }

  // 10 results per page
  let pagesCount = resultCount / 10;
  console.debug(`Pages for this result: ${pagesCount}`);

  const pageToLoad = Math.floor(Math.random() * pagesCount - 1) + 1;
  console.debug(`Page we are going to load: ${pageToLoad}`);

  // If a page was provided then we navigate to it
  // TODO: Navigating to the same page is possible
  try {
    console.debug(`Navigating to page: ${pageToLoad}`);
    await driver.get(`${await driver.getCurrentUrl()}&page=${pageToLoad}`);
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: `Could not navigate to page: ${pageToLoad}`,
      error: e,
      driver,
    };
  }

  // Wait for search results to load again
  try {
    await waitForElement(
      driver,
      '//div[contains(@class, "entity-result")]',
      1000,
      5
    );
    console.debug(`Found results on page: ${pageToLoad}`);
  } catch (e) {
    console.warn(e);

    // Check to see if the page search results container is present
    try {
      await waitForElement(
        driver,
        '//div[@class="search-results-container"]',
        1000,
        2
      );

      console.warn(
        "The page search container is still present meaning there are no more results"
      );

      // If it is still present then that means there are no more results
      return {
        status: false,
        message: "No more results.",
        driver,
      };
    } catch (e) {
      // Do nothing
    }

    // When getting the page, sometimes it won't load. For this we keep clicking the retry button
    while (true) {
      try {
        // Wait for the retry button
        await waitForElement(
          driver,
          '//button/span[text()="Retry search"]',
          1000,
          2
        );

        console.debug(
          'Found "Retry search" button - going to keep clicking until resuls are present'
        );

        // Click the retry button
        await driver
          .findElement(By.xpath('//button/span[text()="Retry search"]'))
          .click();

        // Wait for the results
        await waitForElement(
          driver,
          '//div[contains(@class, "entity-result")]',
          1000,
          2
        );
        console.debug("Results are present");

        // Break if results have been found
        break;
      } catch (e) {
        // Do nothing
      }
    }
  }

  let results = [];

  try {
    const linkElems = await driver.findElements(
      By.xpath('//span/a[contains(@class, "app-aware-link")]')
    );

    linkElems.length === 0
      ? console.warn("No links found")
      : console.debug(`Found ${linkElems.length} links to LinkedIn pages`);

    for (let linkElem of linkElems) {
      try {
        const link = await linkElem.getAttribute("href");
        console.debug(`Found link: ${link}`);
        results.push(link);
      } catch (e) {
        console.warn(e);
        console.warn(`Could not get link for: ${linkElem}`);
      }
    }
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Failed to locate search results.",
      error: e,
      driver,
    };
  }

  return { status: true, driver, results };
}

/**
 * Gathers all relevant information for a given LinkedIn page.
 * @param {driver} driver - The webdriver for Chrome.
 * @param {string} href - The LinkedIn page you want to gather data on.
 * @returns object - Data containing all relevant information on the LinkedIn page.
 */
async function researchLinkedInPage(driver, href) {
  // Data object for the current website
  const data = {};

  try {
    console.debug(`Getting LinkedIn page: ${href}`);
    await driver.get(href);
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: "Failed to load linkedIn",
      error: e,
      driver,
    };
  }

  // Grab the title of the page
  try {
    await waitForElement(driver, "//h1/span", 1000, 5);
    const titleElem = await driver.findElement(By.xpath("//h1/span"));
    console.debug("Found title");
    data.title = await titleElem.getText();
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: `Failed to get title of the page for ${href}`,
      error: e,
      driver,
    };
  }

  // Go to the about section
  try {
    await driver.findElement(By.xpath('//a[text()="About"]')).click();

    // Wait for the content to load
    await waitForElement(driver, '//h2[text()="Overview"]', 1000, 5);
    console.debug("Found overview of the page");
  } catch (e) {
    console.warn(e);
    return {
      status: false,
      message: `Could not navigate to about page for: ${href}`,
      error: e,
      driver,
    };
  }

  // Overview
  try {
    const overview = await driver.findElement(
      By.xpath('//p[contains(@class, "t-black--light")]')
    );
    console.debug("Found the overview text");
    data.overview = await overview.getText();
  } catch (e) {
    console.log(`Found no description for: ${href}`);
  }

  // Industry
  try {
    const industry = await driver.findElement(
      By.xpath('//dd[preceding::dt[1][text()="Industry"]]')
    );
    console.debug("Found the industry");
    data.industry = await industry.getText();
  } catch (e) {
    console.log(`Found no industry for: ${href}`);
  }

  // Founded
  try {
    const founded = await driver.findElement(
      By.xpath('//dd[preceding::dt[1][text()="Founded"]]')
    );
    console.debug("Found the date the company was founded");
    data.founded = await founded.getText();
  } catch (e) {
    console.log(`Found no founded date for: ${href}`);
  }

  // Phone
  try {
    const phone = await driver.findElement(
      By.xpath(
        '//dd[preceding::dt[1][text()="Phone"]]//span[not(contains(@class, "visually-hidden"))]'
      )
    );
    console.debug("Found the phone number");
    data.phone = (await phone.getText()).replace(/\s/g, "");
  } catch (e) {
    console.log(`Found no phone number for: ${href}`);
  }

  // Website
  try {
    const website = await driver.findElement(
      By.xpath('//dd[preceding::dt[1][text()="Website"]]')
    );
    console.debug("Found the website");
    data.website = await website.getText();
  } catch (e) {
    console.log(`Found no website for: ${href}`);
  }

  // Headquarters
  try {
    const headquarters = await driver.findElement(
      By.xpath('//dd[preceding::dt[1][text()="Headquarters"]]')
    );
    console.debug("Found the headquarters");
    data.headquarters = await headquarters.getText();
  } catch (e) {
    console.log(`Found no headquarters for: ${href}`);
  }

  // Type
  try {
    const type = await driver.findElement(
      By.xpath('//dd[preceding::dt[1][text()="Type"]]')
    );
    console.debug("Found the company type");
    data.type = await type.getText();
  } catch (e) {
    console.log(`Found no type for: ${href}`);
  }

  // Next we look into the people of the company
  // ? I don't think this is reliable as the manual replication doesn't pan out well
  const employeesResult = await searchLinkedInEmployees(
    driver,
    // The current URL we are on is safe to use
    await driver.getCurrentUrl()
  );

  if (employeesResult.status && employeesResult.data) {
    if (employeesResult.data.length !== 0) {
      data.employees = employeesResult.data;
    } else {
      console.log(`No employees found for: ${href}`);
    }
  } else {
    console.warn(employeesResult.message || employeesResult);
    console.log(`No employees found for: ${href}`);
  }

  driver = employeesResult.driver;

  console.debug(
    `Got data on LinkedIn page: ${href}, data: ${JSON.stringify(data)}`
  );

  return {
    status: true,
    data,
    driver,
  };
}

async function searchLinkedInEmployees(driver, link) {
  // The data object that will be returned on success
  let data = [];

  let pageCounter = 1;

  // Titles are inputted by the owner of the profile meaning we
  // have to try and match for commonly inputted values
  const validTitles = [
    "Director",
    "Founder",
    "Co-Founder",
    "Cofounder",
    "Creator",
    "Managing Director",
    "Manager",
    "Company Director",
    "Business Development Manager",
    "Chief Executive Officer",
    "Digital Marketing Executive",
    "Marketing Manager",
    "CEO",
    "President",
    "Owner",
    "Business Owner",
  ];

  console.debug(
    `Valid job titles we are searching for: ${JSON.stringify(validTitles)}`
  );

  try {
    // If the current page is not the link provided then we navigate to it
    if ((await driver.getCurrentUrl()) !== link) {
      console.debug(`Link does not match so we are loading the page: ${link}`);
      await driver.get(link);
    }

    await waitForElement(
      driver,
      '//a[contains(@href, "/search/results/people")]',
      1000,
      2
    );
    console.debug("Found the employees link");

    await driver
      .findElement(By.xpath('//a[contains(@href, "/search/results/people")]'))
      .click();

    // Wait for the results
    await waitForElement(
      driver,
      '//div[@class="entity-result__item"]',
      1000,
      5
    );
    console.debug("Found employees");

    // Save the link for future reference
    const employeesPageLink = await driver.getCurrentUrl();

    // Change this to break out the loop
    let willBreak = false;

    // While true we go through the pages
    while (!willBreak) {
      try {
        await waitForElement(
          driver,
          '//div[@class="entity-result__item"]',
          1000,
          2
        );
        console.debug("Found employee results");

        const employeeRowsXpath = '//div[@class="entity-result__item"]';

        // Get all the employees for the page
        const employeeRows = await driver.findElements(
          By.xpath(employeeRowsXpath)
        );
        console.debug("Got employee rows");

        // By default there are 10 results per page, we can check if there are 10 results and if so then we move onto the next page
        // TODO: Sometimes LinkedIn limits employees results to only 3 people, navigating pages then breaks
        if (
          (employeeRows.length < 10 &&
            // TODO: Temp change to cater for LinkedIn limiting
            employeeRows.length !== 3) ||
          // Break out if we are on the 5th page
          pageCounter >= 5
        ) {
          console.debug(
            "We are going to stop searching employees now - either we have searched the 5th page or the last page"
          );
          willBreak = true;
        }

        // Loop through each row
        employeeLoop: for (let i = 1; i <= employeeRows.length; i++) {
          let titleText;

          try {
            // Get the job title element
            const employeeJobTitle = await driver.findElement(
              By.xpath(
                `(${employeeRowsXpath})[${i}]//div[contains(@class, "entity-result__primary-subtitle")]`
              )
            );
            titleText = await employeeJobTitle.getText();

            if (!titleText) {
              throw new Error("No job title text found");
            }

            console.debug(
              `Got the job text for the current employee: ${titleText}`
            );
          } catch (e) {
            console.warn("Couldn't get the job title on the person");

            // We just continue
            continue;
          }

          // Loop through all valid titles
          for (let employeeTitle of validTitles) {
            // Check if the job title starts with any valid job titles (the ones we are looking for)
            if (
              titleText.toLowerCase().indexOf(employeeTitle.toLowerCase()) === 0
            ) {
              console.debug(
                `The job title: ${titleText} is valid and is what we are looking for`
              );
              try {
                // Get the name of the person, this will only return names not "LinkedIn Member"
                const nameElement = await driver.findElement(
                  By.xpath(
                    `(${employeeRowsXpath})[${i}]//span[contains(@class, "entity-result__title-text")]/a/span/span[text() and @aria-hidden]`
                  )
                );
                const nameText = await nameElement.getText();

                console.debug(`Got the name of the person: ${nameText}`);

                // Add the name and job title to the data to return
                data.push({
                  name: nameText,
                  jobTitle: employeeTitle,
                });
              } catch (e) {
                // Do nothing
                console.warn("Couldn't find the name of the person");
              }

              // We have either added the title for this person so we can break out the loop
              // that checks for valid titles or we couldn't get the name of the person
              // so we just skip this person
              continue employeeLoop;
            } else {
              console.warn("Could not get the job title of an employee");
            }
          }
        }
      } catch (e) {
        console.warn(e);

        return {
          status: false,
          message: "An error occured when trying to find employees",
          error: e,
          driver,
        };
      }

      if (!willBreak) {
        // Now we have done our checks, we can load the next page
        try {
          // Increment the page counter
          pageCounter++;

          console.debug(`Loading next page of employees, page: ${pageCounter}`);
          // Get the next page of employees
          await driver.get(`${employeesPageLink}&page=${pageCounter}`);
        } catch (e) {
          // Fail over if we cannot get the next page
          console.warn(e);

          return {
            status: false,
            message: `Could not load page: ${employeesPageLink}&page=${pageCounter}`,
            error: e,
            driver,
          };
        }
      } else {
        console.debug("We have been instructed to break so we quit here");
      }
    }

    console.debug(`Got employee data: ${JSON.stringify(data)}`);

    // If we have broken out then we have got through all the employees
    return {
      status: true,
      data,
      driver,
    };
  } catch (e) {
    // Couldn't get employees for some reason
    console.warn(e);

    return {
      status: false,
      message: `Could not get LinkedIn employees for page`,
      error: e,
      driver,
    };
  }
}
