const axios = require("axios");
const Fs = require("fs");
const Path = require("path");
const Os = require("os");
const pMap = require("p-map");
const readline = require("readline");
const https = require("https");

let cpus = Os.cpus().length;
cpus = cpus > 2 ? cpus : 2;

class WPRemoteImagesSource {
  static defaultOptions() {
    return {
      baseUrl: "https://hub.magnet.co/streetattack",
      restBase: "/wp-json/wp/v2/magnetic_portfolio",
      imageDirectory: "src/assets/images",
      sizeToDownload: "medium_large",
      typeName: "WordPressPortfolioImage",
      belongsToTypeName: "WordPressMagneticPortfolio"
    };
  }

  constructor(api, options) {
    this.options = {
      ...WPRemoteImagesSource.defaultOptions(),
      ...options
    };

    this.store = api.store;

    api.loadSource(async store => {
      this.cTypeImages = store.addContentType(this.options.typeName);

      console.log(
        `Loading images from ${this.options.baseUrl + this.options.restBase}`
      );

      const { data } = await axios.get(
        `${this.options.baseUrl + this.options.restBase}`
      );

      //download images for each post
      for (const post of data) {
        await this.downloadImages(post);
        await this.addImagesToGraphql(post);
      }
    });
  }

  /**
   * Download post images to the local machine
   * @param {Object} post
   */
  async downloadImages(post) {
    // create directory if it doesn't exist
    this.createDirectory(this.options.imageDirectory);

    this.images = [];

    post.acf.gallery.forEach(async imgObj => {
      this.addImageToQueue(imgObj.sizes[this.options.sizeToDownload]);
    });

    // check if some images already exist and create download queue
    let exists = 0;
    const downloadQueue = [];

    Object.keys(this.images).forEach(async id => {
      const { filepath } = this.images[id];

      if (!this.exists(filepath)) {
        downloadQueue.push(this.images[id]);
      } else exists++;
    });

    const total = downloadQueue.length;
    let progress = 0;

    console.log(`${exists} images already exists, ${total} images to download`);

    if (total) {
      await pMap(
        downloadQueue,
        async ({ filename, url, filepath }) => {
          if (!this.exists(filepath)) {
            //download only those images that are not downloaded already
            await this.download(url, filepath);
          }
          status(
            `${Math.round(
              (++progress * 100) / total
            )}% – Downloaded ${filename}`
          );
        },
        {
          concurrency: cpus * 2
        }
      );

      status("100% – ");
      console.log(`${total} images downloaded`);
    }

    // Helper function for writing status in the console during build
    function status(msg) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0, null);
      process.stdout.write(msg);
    }
  }

  /**
   * Add each image to GraphQL layer,
   * with a reference to the post it belongs to
   * @param {Object} post
   */
  addImagesToGraphql(post) {
    Object.keys(this.images).forEach(async id => {
      const { filepath } = this.images[id];
      this.cTypeImages.addNode({
        image: filepath,
        magnetic_portfolio: this.store.createReference(
          this.options.belongsToTypeName,
          post.id
        )
      });
    });
  }

  /**
   * Create image object and add it to the queue to be processed
   * @param {String} url
   */
  addImageToQueue(url) {
    if (
      url &&
      String(url).match(/^https:\/\/.*\/.*\.(jpg|png|svg|gif|jpeg)($|\?)/i)
    ) {
      const filename = this.getFilename(url, this.regex);
      const id = this.store.makeUid(filename);
      const filepath = this.getFullPath(this.options.imageDirectory, filename);
      if (!this.images[id])
        this.images[id] = {
          filename,
          url,
          filepath
        };
    }
  }

  /**
   * Download image from url to the specified destination
   *
   * @param {String} url
   * @param {String} path
   */
  download(url, path) {
    return new Promise(function(resolve) {
      const file = Fs.createWriteStream(path);
      const request = https
        .get(url, response => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        })
        .on("error", err => {
          console.error(err.message);
          Fs.unlink(String(path), resolve);
        });
    });
  }

  createDirectory(dir) {
    const pwd = Path.join(process.cwd(), dir);
    if (!Fs.existsSync(pwd)) Fs.mkdirSync(pwd, { recursive: true });

    return pwd;
  }

  getFullPath(dir, filename) {
    return Path.join(process.cwd(), dir, filename);
  }

  getFilename(url, regex) {
    let name = url
      .replace(/%2F/g, "/")
      .split("/")
      .pop()
      .replace(/\#(.*?)$/, "")
      .replace(/\?(.*?)$/, "");
    return regex ? name.replace(regex, "$1$2") : name;
  }

  exists(filepath) {
    return Fs.existsSync(filepath);
  }
}

module.exports = WPRemoteImagesSource;
