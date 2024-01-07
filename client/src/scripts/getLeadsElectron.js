//------------------------------------------------------------------------------------//
// Modules
//------------------------------------------------------------------------------------//

// import * as fetch from "node-fetch";
// import * as cheerio from "cheerio";
// import { EventEmitter } from "events";
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const EventEmitter = require("events").EventEmitter;

//------------------------------------------------------------------------------------//
// Config
//------------------------------------------------------------------------------------//

EventEmitter.defaultMaxListeners = 15;
let cors =
  process.env.NODE_ENV === "development"
    ? "https://enigmatic-springs-75355.herokuapp.com/" // Use CORS proxy for localhost development
    : ""; // Define cors anywhere so we can get the data from a client side script
// const headers = { "Content-Type": "text/html", Origin: "http://localhost", 'X-Powered-By': 'CORS Anywhere' };
const headers = {};

//------------------------------------------------------------------------------------//
// Functions
//------------------------------------------------------------------------------------//

/*
This function calls the other functions to get information on websites that google
responds with.
*/
async function GetProspects(searchTerm, results, time) {
  let jsonResponse = { status: true, body: { results: {} } };

  if (!searchTerm) {
    console.log(
      JSON.stringify(
        {
          status: false,
          body: { msg: "Provide a search term with 'searchTerm=query'" },
        },
        null,
        2
      )
    );
    return;
  }

  // Get 100 results everytime as some links may be dupes
  let googleSearchString = `https://www.google.com/search?q=${searchTerm}&num=100`;

  if (time === "d" || time === "w" || time === "m") {
    // Show google indexes within the past 24 hours | 7 days | 1 month
    googleSearchString += `&as_qdr=${time}`;
  }

  let searchGoogle = await CheckGoogleBotLock();

  if (!searchGoogle) {
    // If we haven't waited at least an hour, dont search
    console.log(
      JSON.stringify(
        {
          status: false,
          body: { msg: "Please wait 1 hour till searching again" },
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Getting google searches: " + googleSearchString);
  let links = await SearchGoogle(googleSearchString);
  if (!links.status) {
    console.log(
      JSON.stringify({ status: false, body: { msg: links.body.msg } }, null, 2)
    );
    return;
  }

  links = GetUnique(links.body); // Remove duplicate domains
  if (results <= 100) {
    links = links.slice(0, results); // Only return the links we are interested in
  } else {
    console.log(
      JSON.stringify(
        {
          status: false,
          body: { msg: "Cannot return more than 100 websites" },
        },
        null,
        2
      )
    );
    return;
  }

  if (links.length > 0) {
    for (let link of links) {
      console.log(`Getting info on: ${link}`);
      try {
        let result = await CreateJsonInfo(link);
        if (result.status) {
          jsonResponse.body.results = {
            ...jsonResponse.body.results,
            ...result.body,
          };
        }
      } catch (e) {
        console.log(e); // Don't fail over if 1 link search fails
      }
    }
  } else {
    jsonResponse.body.msg = "Could not find any links";
    console.log(JSON.stringify(jsonResponse, null, 2));
    return;
  }

  return jsonResponse;
}

/*
Gets results from a google search. This will return a list of links bases on the search
results with the provided options. The links returned are sorted in order of the search
results but are not weeded for duplicates.
*/
function SearchGoogle(link) {
  return new Promise(async (resolve, reject) => {
    let jsonResponse = { status: true, body: {} };

    // Get HTML of website
    let html, $;
    try {
      html = await (await fetch(cors + link, { headers })).text();
      $ = cheerio.load(html);
    } catch (err) {
      return reject({ status: false, body: { msg: err } });
    }

    let botDetection = $("#infoDiv"); // Check for Google's bot detection
    if (botDetection.length) {
      let text = botDetection.text();
      if (
        text.match(
          /This page appears when Google automatically detects requests/
        )
      ) {
        // Write the date and time to the file
        window.ipcRenderer.invoke(
          "createGoogleBotLock",
          new Date(new Date().getTime())
        );
        return reject({
          status: false,
          body: { msg: "Google detected bot detection" },
        });
      }
    }

    let links = [];

    let results = $("h3").parent("a"); // Get the results from the page
    if (results.length) {
      results.each((i, elem) => {
        let href = $(elem).attr("href");
        if (href) {
          href = href.replace(/^.*?q=/, ""); // Replace the rubbish at the beginning
          links.push(href);
        }
      });
    } else {
      return reject({
        status: false,
        body: { msg: "Could not get search results" },
      });
    }

    if (links.length > 0) {
      jsonResponse.body = links;
      return resolve(jsonResponse);
    } else {
      return reject({ status: false, body: { msg: "No results found" } });
    }
  });
}

/*
This function will look through an array of links and remove the duplicates based on the
domain.
*/
function GetUnique(links) {
  let correctedArray = [];
  for (let link of links) {
    link = link.replace(
      /((\.com)|(\.co\.uk)|(\.org(\.uk)?)|(\.uk)|(\.co)).*/,
      "$1"
    ); // Replace everything after the .com identifier | only get the domain
    correctedArray.push(link);
  }
  correctedArray = [...new Set(correctedArray)];
  return correctedArray;
}

/*
This function will return information such as contact info and social media stats and links.
This function is the parent function that calls other functions to get the specific data
from social media sites.
*/
function CreateJsonInfo(link) {
  return Promise.race([
    new Promise(async (resolve, reject) => {
      let jsonResponse = { status: true, body: {} };

      let json = {};
      let identifier = link.replace(/^.*?\/\//, ""); // Replace everything up to the first //
      identifier = identifier.replace(/^.*?((www)|(uk)|(en))\./, ""); // Replace the first www. or other identifiers
      let domainName = identifier;
      domainName = domainName.replace(/\/.*/, ""); // Replace everything after the first forward slash
      identifier = identifier.replace(/\..*$/, ""); // Replace everything after the first "."
      let promises = []; // List of promises to wait on

      json[identifier] = {
        // Create the initial template for information
        website: link,
        facebookPage: {},
        twitterPage: {},
        instagramPage: {},
        contactPage: {},
        domainName: domainName || "",
      };

      // Get HTML of website
      let html, $;
      try {
        html = await (await fetch(cors + link, { headers })).text();
        $ = cheerio.load(html);
      } catch (err) {
        return reject({ status: false, body: { msg: err } });
      }

      let hrefs = $("a[href]"); // Get all hrefs

      // Get Facebook details
      let facebook = hrefs
        .filter((i, elem) => {
          return $(elem)
            .attr("href")
            .match(/facebook\.com\/(?!sharer)/);
        })
        .first();

      if (facebook.length) {
        let href = facebook.attr("href");
        if (href) {
          json[identifier].facebookPage.link = href.replace(
            /(\.com\/.*?)\/.*/,
            "$1"
          ); // Replace everything after the identifier
          json[identifier].facebookPage.status = true;
          promises.push(
            CheckFacebook(json[identifier].facebookPage.link).catch((err) => ({
              status: false,
              err,
            }))
          );
        }
      }

      // Get Twitter details
      let twitter = hrefs
        .filter((i, elem) => {
          return $(elem)
            .attr("href")
            .match(/twitter\.com\/(?!intent)/);
        })
        .first();

      if (twitter.length) {
        let href = twitter.attr("href");
        if (href) {
          json[identifier].twitterPage.link = href.replace(
            /(\.com\/.*?)\/.*/,
            "$1"
          ); // Replace everything after the identifier
          json[identifier].twitterPage.status = true;
          promises.push(
            CheckTwitter(json[identifier].twitterPage.link).catch((err) => ({
              status: false,
              err,
            }))
          );
        }
      }

      // Get Instagram details
      let instagram = hrefs
        .filter((i, elem) => {
          return $(elem)
            .attr("href")
            .match(/instagram\.com\/.*/);
        })
        .first();

      if (instagram.length) {
        let href = instagram.attr("href");
        if (href) {
          json[identifier].instagramPage.link = href.replace(
            /(\.com\/.*?)\/.*/,
            "$1"
          ); // Replace everything after the identifier
          json[identifier].instagramPage.status = true;
          promises.push(
            CheckInsta(json[identifier].instagramPage.link).catch((err) => ({
              status: false,
              err,
            }))
          );
        }
      }

      // Get Contact details
      let contactPageElem = hrefs
        .filter((i, elem) => {
          let link = $(elem)
            .attr("href")
            .replace(/(.*?\/\/.*?\/)|(^\/)/, ""); // Regex out the domain but keep page identifier
          return link.match(/contact/i);
        })
        .first();

      if (contactPageElem.length) {
        let contactPage = contactPageElem.attr("href");
        if (contactPage) {
          json[identifier].contactPage.link =
            link + "/" + contactPage.replace(/(.*?\/\/.*?\/)|(^\/)/, "");
          promises.push(
            GetContactInfo(json[identifier].contactPage.link).catch((err) => ({
              status: false,
              err,
            }))
          );
        }
      }

      // Create the object with all the data returned
      let contactInfo = await Promise.all(promises);
      if (contactInfo.length === 4) {
        if (contactInfo[0].status) {
          json[identifier].facebookPage = {
            ...json[identifier].facebookPage,
            ...contactInfo[0].body,
          };
        }

        if (contactInfo[1].status) {
          json[identifier].twitterPage = {
            ...json[identifier].twitterPage,
            ...contactInfo[1].body,
          };
        }

        if (contactInfo[2].status) {
          json[identifier].instagramPage = {
            ...json[identifier].instagramPage,
            ...contactInfo[2].body,
          };
        }

        if (contactInfo[3].status) {
          json[identifier].contactPage = {
            ...json[identifier].contactPage,
            ...contactInfo[3].body,
          };
        }

        // Set status of calls
        json[identifier].facebookPage.status = contactInfo[0].status;
        json[identifier].twitterPage.status = contactInfo[1].status;
        json[identifier].instagramPage.status = contactInfo[2].status;
        json[identifier].contactPage.status = contactInfo[3].status;
      }

      jsonResponse.body = json;
      return resolve(jsonResponse);
    }),
    new Promise((resolve) =>
      setTimeout(() => {
        resolve({
          status: false,
          message: "Took longer than 10 seconds to get website info",
        });
      }, 10000)
    ),
  ]);
}

/*
This function returns the contact number found in a link provided. Provide a
contact page link for the best result.
*/
function GetContactInfo(link) {
  return new Promise(async (resolve, reject) => {
    let jsonResponse = { status: true, body: {} };

    // Get HTML of website
    let html, $;
    try {
      html = await (await fetch(cors + link, { headers })).text();
      $ = cheerio.load(html);
    } catch (err) {
      return reject({ status: false, body: { msg: err } });
    }

    let textElems = $("body *").filter((i, elem) => {
      // Get all text elements
      return $(elem).text();
    });

    // Get contact number
    let contactNumberElem = textElems
      .filter((i, elem) => {
        // Get all numbers that match 11 digits
        if (
          $(elem)
            .text()
            .match(/.*\d[\d\s]{10,12}.*/g)
        ) {
          let number = $(elem).text().replace(/\D/, "");
          return number.length === 11;
        }
        return false;
      })
      .first();

    if (contactNumberElem.length) {
      let contactNumber = $(contactNumberElem).text().replace(/\D/, "");
      if (contactNumber) {
        jsonResponse.body.number = contactNumber;
      }
    }

    // Get contact email
    let emailElem = textElems
      .filter((i, elem) => {
        return $(elem)
          .text()
          .match(/\s\w+@\w+[.\w]+\s/);
      })
      .first();

    if (emailElem.length) {
      let email = $(emailElem).text();
      if (email) {
        jsonResponse.body.email = email.match(/\s(\w+@\w+[.\w]+)\s/)[1];
      }
    }

    return resolve(jsonResponse);
  });
}

/*
Get information on a Facebook page.
*/
function CheckFacebook(link) {
  return new Promise(async (resolve, reject) => {
    let jsonResponse = {
      status: true,
      body: {
        likes: 0,
        followers: 0,
        pageTitle: "",
      },
    };

    // Get HTML of website
    let html, $;
    try {
      html = await (await fetch(cors + link, { headers })).text();
      $ = cheerio.load(html);
    } catch (err) {
      return reject({ status: false, body: { msg: err } });
    }

    let textElems = $("body *").filter((i, elem) => {
      return $(elem).text();
    });

    // Getting the likes of the Facebook page
    let likes = textElems
      .filter((i, elem) => {
        if ($(elem).is("div")) {
          return $(elem)
            .text()
            .match(/people like this/);
        } else {
          return false;
        }
      })
      .last();
    if (likes.length) {
      likes = $(likes).text().replace(/\D/g, "");
      jsonResponse.body.likes = parseInt(likes);
    }

    // Getting the followers of the Facebook page
    let followers = textElems
      .filter((i, elem) => {
        if ($(elem).is("span")) {
          return $(elem)
            .text()
            .match(/people follow this/);
        } else {
          return false;
        }
      })
      .last();
    if (followers.length) {
      followers = $(followers).text().replace(/\D/g, "");
      jsonResponse.body.followers = parseInt(followers);
    }

    // Getting the name of the Facebook page
    let title = $("h1 > span")
      .filter((i, elem) => {
        return $(elem).text();
      })
      .first();
    if (title.length) {
      jsonResponse.body.pageTitle = title.text();
    }

    return resolve(jsonResponse);
  });
}

/*
Get information on a Twitter page.
*/
function CheckTwitter(link) {
  return new Promise(async (resolve, reject) => {
    let jsonResponse = {
      status: true,
      body: {
        followers: 0,
        following: 0,
      },
    };

    // Get HTML of website
    let html, $;
    try {
      html = await (await fetch(cors + link, { headers })).text(); // Twitter is rejecting request
      $ = cheerio.load(html);
    } catch (err) {
      return reject({ status: false, body: { msg: err } });
    }

    // Get all anchor tags
    let anchors = $("a");

    // Get 'following' anchor tags
    let followingTags = $(anchors).filter((i, elem) => {
      if ($(elem).attr("href")) {
        return $(elem)
          .attr("href")
          .match(/following/);
      } else {
        return false;
      }
    });

    // Get following
    let following;
    if (followingTags.length) {
      following = $(followingTags).find("span");
      if (following.length) {
        following = $(following).filter((i, elem) => {
          return $(elem).attr("data-count");
        });
      }
    }

    if (following) {
      jsonResponse.body.following = following;
    }

    // Get 'followers' anchor tags
    let followerTags = $(anchors).filter((i, elem) => {
      if ($(elem).attr("href")) {
        return $(elem)
          .attr("href")
          .match(/followers/);
      } else {
        return false;
      }
    });

    // Get followers
    let followers;
    if (followerTags.length) {
      followers = $(followerTags).find("span");
      if (followers.length) {
        followers = $(followers).filter((i, elem) => {
          return $(elem).attr("data-count");
        });
      }
    }

    if (followers) {
      jsonResponse.body.followers = followers;
    }

    return resolve(jsonResponse);
  });
}

/*
Get information on an Instagram page.
*/
function CheckInsta(link) {
  return new Promise(async (resolve, reject) => {
    let jsonResponse = {
      status: true,
      body: {
        followers: 0,
        following: 0,
      },
    };

    // Get HTML of website
    // let html, $;
    // try {
    //   html = await (await fetch(cors + link, { headers })).text();
    //   $ = cheerio.load(html); // TODO: Implement
    // } catch (err) {
    //   return reject({ status: false, body: { msg: err } });
    // }

    return resolve(jsonResponse);
  });
}

/*
Check to see if Google has temporarily banned anymore google searches
*/
function CheckGoogleBotLock() {
  return window.ipcRenderer.invoke("checkGoogleBotLock");
}

//------------------------------------------------------------------------------------//
// Structure
//------------------------------------------------------------------------------------//

// Create wrapper which can be called by a front-end
const getLeads = ({ search, count, timeframe }) => {
  return new Promise(async (resolve, reject) => {
    let result;
    try {
      search = search.replace(/\s/g, "%20"); // Replace the spaces with something URL safe
      result = await GetProspects(search, count, timeframe);
    } catch (e) {
      return reject(e);
    }
    return resolve(result);
  });
};

module.exports.GetWebsiteInfo = CreateJsonInfo;
module.exports.getLeads = getLeads;
