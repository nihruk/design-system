const path = require('path');
var glob = require('glob-all');
const webpack = require('webpack');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const {PurgeCSSPlugin} = require('purgecss-webpack-plugin');
const Handlebars = require("handlebars");
const fs = require("fs");

//PurgeCSS Paths
const purgeCSSPaths = {
  src: path.join(__dirname, 'src', 'html'),
  partials: path.join(__dirname, 'src', 'partials')
};

// paths used in various placed in webpack config
const paths = {
  src: {
    imgs: './src/assets/images',
    scss: './src/assets/scss',
    fonts: './src/assets/fonts',
    js: './src/assets/js',
    favicon: './src/assets/favicon',
    html: path.join(__dirname, 'src', 'html'),
    partials: path.join(__dirname, 'src', 'partials'),
  },
  dist: {
    imgs: './assets/images',
    css: './assets/css',
    fonts: './assets/fonts',
    js: './assets/js',
    favicon: './assets/favicon',
    html: path.join(__dirname, 'dist'),
  }
};

function registerPartialsDirectory(directoryPath, directoryNameParts = []) {
  fs.readdirSync(directoryPath)
    .forEach((filename) => {
      if (fs.statSync(path.join(directoryPath, filename)).isDirectory()) {
        return registerPartialsDirectory(
            path.join(directoryPath, filename),
            [...directoryNameParts, filename],
            )
      }
      Handlebars.registerPartial(
          [...directoryNameParts, filename.slice(0, -5)].join('/'),
          fs.readFileSync(path.join(directoryPath, filename), 'utf8'),
      );
    });
}
registerPartialsDirectory(paths.src.partials)

module.exports = (env, args) => {
  const production = args.mode === 'production'
  const configuration = {
    entry: {
      libs: [paths.src.scss + '/libs.scss'],
      theme: [paths.src.js + '/theme.js', paths.src.scss + '/theme.scss'],
    },
    output: {
      filename: paths.dist.js + '/[name].bundle.js'
    },
    mode: args.mode,
    module: {
      rules: [
        {
          test: /\.(sass|scss|css)$/,
          include: path.resolve(__dirname, paths.src.scss.slice(2)),
          use: [
            {
              loader: MiniCssExtractPlugin.loader
            },
            {
              loader: 'css-loader',
              options: {
                url: false,
                sourceMap: !production
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: !production,
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: !production,
                sassOptions: {
                  indentWidth: 4,
                  outputStyle: production ? 'compressed' : 'expanded',
                  sourceComments: !production
                }
              }
            }
          ]
        }
      ]
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/](node_modules)[\\/].+\.js$/,
            name: 'vendor',
            chunks: 'all'
          }
        }
      },
      minimizer: [
        new CssMinimizerPlugin(),
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            output: {
              comments: false
            }
          }
        })
      ]
    },
    plugins: [
      new webpack.ProgressPlugin(),
      new CopyPlugin({
        patterns: [
          {
            from: paths.src.fonts,
            to: paths.dist.fonts,
            noErrorOnMissing: true
          },
          {
            from: paths.src.imgs,
            to: paths.dist.imgs,
            noErrorOnMissing: true
          },
          {
            from: paths.src.favicon,
            to: paths.dist.favicon,
            noErrorOnMissing: true
          },
          {
            from: paths.src.html,
            to: paths.dist.html,
            transform: (content) => Handlebars.compile(content.toString())()
          }
        ]
      }),
      new RemoveEmptyScriptsPlugin(),
      new MiniCssExtractPlugin({
        filename: paths.dist.css + '/[name].bundle.css'
      }),
      new PurgeCSSPlugin({
        paths: glob.sync([`${purgeCSSPaths.src}/**/*`, `${purgeCSSPaths.partials}/**/*`], {
          nodir: true
        }),
        safelist: {
          greedy: [
            /show$/,
            /collapsing$/,
            /aos/,
            /data/,
            /reveal/,
            /show-filters/,
            /modal/,
            /collapse/,
            /slideout/
          ]
        }
      })
    ]
  }
  if (!production) {
    configuration.devtool = 'eval-source-map'
  }

  return configuration
}
