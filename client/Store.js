const { app } = require("electron");
const path = require("path");
const fs = require("fs");

class Store {
  /**
   * Create the file for the application
   * @param {object} opts - configName = Name of the file. defaults = Default data to store.
   */
  constructor(opts) {
    const userDataPath = app.getPath("userData");

    this.path = path.join(userDataPath, opts.configName + ".json");

    this.data = parseDataFile(this.path, opts.defaults);
  }

  /**
   * Get the config for the app.
   * @param {string} key - The key of the data to return.
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Save the config for the app.
   * @param {string} key - The key to set the data to.
   * @param {string} val - The data itself.
   */
  set(key, val) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    // If there was an error then return the defaults
    return defaults;
  }
}

class ScreenshotStore {
  /**
   * Create a screenshot folder for the application.
   * @param {object} opts - Containing filenames and their associated png data.
   */
  constructor(opts) {
    const userDataPath = app.getPath("userData");

    this.path = path.join(userDataPath, "screenshots");

    try {
      this.cleanUp(); // Delete the directory
    } catch (e) {} // Do nothing on failure

    this.data = parseScreenshotFolder(this.path, opts ? opts.defaults : {});
  }

  /**
   * Get the png for a filename.
   * @param {string} key - The filename of the screenshot excluding the filename extension.
   */
  get(filename) {
    return this.data[filename];
  }

  /**
   * Create a PNG file.
   * @param {string} key - The filename excluding the filename extension.
   * @param {png} png - The PNG data.
   */
  set(filename, png) {
    this.data[filename] = png;
    fs.writeFileSync(path.join(this.path, `${filename}.png`), png, {
      encoding: "base64",
    });
  }

  /**
   * Cleans up the directory.
   */
  cleanUp() {
    fs.rmdirSync(this.path);
  }
}

function parseScreenshotFolder(folderPath, defaults) {
  // Check if folder exists
  if (fs.existsSync(folderPath)) {
    // Get the list of files
    let files = fs.readdirSync(folderPath);

    try {
      return files.reduce((r, file) => {
        // Read the file and assign it the value
        r[file.replace(/\.png/, "")] = fs.readFileSync(
          path.join(folderPath, file)
        );
        return r;
      }, {});
    } catch (e) {
      console.log("Could not read file.");
      return defaults;
    }
  } else {
    fs.mkdirSync(folderPath); // Make the directory
    for (let [filename, png] of Object.entries(defaults)) {
      const filePath = path.join(folderPath, `${filename}.png`);
      try {
        fs.writeFileSync(filePath, png);
      } catch (e) {
        console.log("Could not write png to file");
        console.log(`PNG: ${png}`);
        console.log(`File path: ${filePath}`);
      }
    }
    return defaults;
  }
}

module.exports = {
  Store,
  ScreenshotStore,
};
