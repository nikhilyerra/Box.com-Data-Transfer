"use strict";
const box = require("box-node-sdk");
const fs = require("fs");
const path = require("path");

// Read and parse configuration file
let configFile = fs.readFileSync("886013191_bsg1z1ys_config.json");
configFile = JSON.parse(configFile);

// Create a Box session
let session = box.getPreconfiguredInstance(configFile);
let client = session.getAppAuthClient("enterprise");
client._useIterators = true;

const folderIds = ["243847804637", "223971544612"];
// Add more folder IDs as needed

function downloadFilesFromFolders(folderId) {
  let folderName;
  let localFolderPath;

  return client.folders
    .get(folderId, null)
    .then((folderInfo) => {
      folderName = folderInfo.name;

      console.log("Folder Name:", folderName);

      return client.folders.getItems(folderId, { limit: 1000 });
    })
    .then((folderItemsIterator) => {
      console.log("Retrieved folder items iterator");
      return autoPage(folderItemsIterator);
    })
    .then((folderItems) => {
      console.log("Retrieved folder items:", folderItems.length);

      let files = folderItems.filter((item) => {
        return item.type === "file";
      });

      console.log("Files in the folder:", files);

      localFolderPath = createLocalFolder(folderName);

      let downloadPromises = [];

      files.forEach((file) => {
        downloadPromises.push(
          client.files.getReadStream(file.id, null).then((stream) => {
            let output = fs.createWriteStream(
              path.join(localFolderPath, file.name)
            );
            stream.pipe(output);
          })
        );
      });

      return Promise.all(downloadPromises);
    })
    .then(() => {
      console.log(`Downloaded all files from folder "${folderName}"`);
      console.log(
        `Files in local folder "${folderName}":`,
        fs.readdirSync(localFolderPath)
      );
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

// Loop through all specified folder IDs
folderIds.forEach((folderId) => {
  downloadFilesFromFolders(folderId);
});

function createLocalFolder(folderName) {
  let localFolderName = path.join(__dirname, folderName);

  try {
    fs.mkdirSync(localFolderName);
    console.log("Local folder created:", localFolderName);
  } catch (e) {
    if (e.code === "EEXIST") {
      console.log("Local folder already exists. Resetting...");
      resetLocalFolder(localFolderName);
      fs.mkdirSync(localFolderName);
    } else {
      console.error("Error creating local folder:", e);
      throw e;
    }
  }

  return localFolderName;
}

function resetLocalFolder(localFolderName) {
  if (fs.existsSync(localFolderName)) {
    console.log("Resetting local folder:", localFolderName);
    fs.readdirSync(localFolderName).forEach((localFileName) => {
      console.log("Removing file:", localFileName);
      fs.unlinkSync(path.join(localFolderName, localFileName));
    });
    fs.rmdirSync(localFolderName);
    console.log("Local folder reset complete");
  }
}

function autoPage(iterator) {
  let collection = [];

  let moveToNextItem = () => {
    return iterator.next().then((item) => {
      if (item.value) {
        collection.push(item.value);
      }
      if (item.done !== true) {
        return moveToNextItem();
      } else {
        return collection;
      }
    });
  };

  return moveToNextItem();
}
