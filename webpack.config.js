const path = require('path');
const webpack = require('webpack');
const glob = require('glob-all');
const HtmlBundlerPlugin = require('html-bundler-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const postcssPresetEnv = require('postcss-preset-env');

const PATHS = {
  pages: path.join(__dirname, 'src/html/'),
  partials: path.join(__dirname, 'src/partials/'),
};

// Create the entry object containing pages located in src/html/ directory.
const entry = glob.sync(path.join(PATHS.pages, '/**/*.html')).reduce((entry, file) => {
  const name = path.relative(PATHS.pages, file).replace(/\.html$/, '');
  entry[name] = file;
  return entry;
}, {});

module.exports = (env, args) => {
  const production = args.mode === 'production'
  const configuration = {
    output: {
      path: path.resolve(__dirname, 'dist'),
    },
    mode: args.mode,
    resolve: {
      alias: {
        '@images': path.join(__dirname, 'src/assets/images'),
        '@styles': path.join(__dirname, 'src/assets/scss'),
        '@scripts': path.join(__dirname, 'src/assets/js'),
      }
    },
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
              loader: 'css-loader',
              options: {
                sourceMap: true
              }
            },
            {
              loader: 'resolve-url-loader',
              options: {
                sourceMap: true
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: true,
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
                sourceMap: true,
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
        },
        {
          test: /\.(ttf|woff2?)$/,
          type: 'asset/resource',
          generator: {
            outputPath: path.join('assets', 'fonts'),
            publicPath: 'assets/fonts/',
            filename: '[name][ext]',
          }
        }
      ]
    },
    optimization: {
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
      new HtmlBundlerPlugin({
        entry,
        js: {
          // output filename of extracted JS
          filename: 'assets/js/[name].[contenthash:8].js',
        },
        css: {
          // output filename of extracted CSS
          filename: 'assets/css/[name].[contenthash:8].css',
        },
        loaderOptions: {
          preprocessor: 'handlebars',
          preprocessorOptions: {
            partials: [PATHS.partials],
          },
        },
      }),
    ]
  }
  if (!production) {
    configuration.devtool = 'eval-source-map'

    // enable live reload
    configuration.devServer = {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      watchFiles: {
        paths: ['src/**/*.*'],
        options: {
          usePolling: true,
        },
      },
    }
  }

  return configuration
}
