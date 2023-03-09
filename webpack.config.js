const path = require('path');
const webpack = require('webpack');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const Handlebars = require("handlebars");
const fs = require("fs");
const postcssPresetEnv = require('postcss-preset-env');

function registerPartialsDirectory(directoryPath, directoryNameParts = []) {
  fs.readdirSync(directoryPath)
    .forEach((filename) => {
      if (fs.statSync(path.resolve(directoryPath, filename)).isDirectory()) {
        return registerPartialsDirectory(
            path.resolve(directoryPath, filename),
            [...directoryNameParts, filename],
            )
      }
      Handlebars.registerPartial(
          [...directoryNameParts, filename.slice(0, -5)].join('/'),
          fs.readFileSync(path.resolve(directoryPath, filename), 'utf8'),
      );
    });
}
registerPartialsDirectory(path.resolve(__dirname, 'src', 'partials'))

module.exports = (env, args) => {
  const production = args.mode === 'production'
  const configuration = {
    entry: {
      'design-system': [
          path.resolve(__dirname, 'src', 'assets', 'scss', 'libs.scss'),
          path.resolve(__dirname, 'src', 'assets', 'js', 'theme.js'),
          path.resolve(__dirname, 'src', 'assets', 'scss', 'theme.scss'),
      ],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
    },
    mode: args.mode,
    module: {
      rules: [
        {
          test: /\.(js)$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true,
                presets: [
                  [
                    '@babel/preset-env',
                  ]
                ]
              }
            },
          ]
        },
        {
          test: /\.(sass|scss|css)$/,
          use: [
            {
              loader: MiniCssExtractPlugin.loader
            },
            {
              loader: 'css-loader',
              options: {
                sourceMap: !production
              }
            },
            {
              loader: 'resolve-url-loader',
              options: {
                sourceMap: !production
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: !production,
                postcssOptions: {
                  plugins: [
                      'autoprefixer',
                      postcssPresetEnv(),
                  ],
                },
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
        },
        {
          test: /\.(png|gif|jpg|jpeg)$/,
          type: 'asset/resource',
          generator: {
            outputPath: path.join('assets', 'images'),
            filename: '[name][ext]',
          }
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
      new RemoveEmptyScriptsPlugin(),
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'src', 'html'),
            to: path.resolve(__dirname, 'dist'),
            transform: (content) => Handlebars.compile(content.toString())()
          },
          {
            from: path.resolve(__dirname, 'src', 'assets', 'images'),
            to: path.resolve(__dirname, 'dist', 'assets', 'images'),
          }
        ]
      }),
      new MiniCssExtractPlugin({
        filename: '[name].bundle.css',
      }),
    ]
  }
  if (!production) {
    configuration.devtool = 'eval-source-map'
  }

  return configuration
}
