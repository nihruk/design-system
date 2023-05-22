const {globSync} = require('glob')
const path = require('path');
const webpack = require('webpack');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const postcssPresetEnv = require('postcss-preset-env');
const nunjucks = require('./src/docs/js/nunjucks')


const WATCH_FILES_PATTERNS = [
  [__dirname, 'src', 'macros', '**', '*.html'].join('/'),
  [__dirname, 'src', 'docs', 'macros', '**', '*.html'].join('/'),
  [__dirname, 'src', 'docs', 'partials', '**', '*.html'].join('/'),
  [__dirname, 'src', 'docs', 'templates', '**', '*.html'].join('/'),
  [__dirname, 'src', 'docs', 'www', '**', '*.html'].join('/'),
]


class WatchPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(WatchPlugin.name, (compilation, callback) => {
      for (const filePath of globSync(WATCH_FILES_PATTERNS)) {
        compilation.fileDependencies.add(path.resolve(filePath))
      }
      callback()
    });
  }
}


class AssetEmitterPlugin {
  constructor() {
    this._assets = {}
  }

  emit(path, content) {
    this._assets[path] = content
  }

  apply(compiler) {
    const { webpack } = compiler;
    const { Compilation } = webpack;
    const { RawSource } = webpack.sources;

    compiler.hooks.thisCompilation.tap(AssetEmitterPlugin.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: AssetEmitterPlugin.name,
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          for (const [path, content] of Object.entries(this._assets)) {
            compilation.emitAsset(path, new RawSource(content))
          }
          this._assets = []
        }
      );
    });
  }
}

const assetEmitterPlugin = new AssetEmitterPlugin()

module.exports = (env, args) => {
  const production = args.mode === 'production'
  const configuration = {
    entry: {
      'design-system': [
          path.resolve(__dirname, 'src', 'assets', 'js', 'dist.js'),
          path.resolve(__dirname, 'src', 'assets', 'scss', 'dist.scss'),
      ],
      'docs': [
          path.resolve(__dirname, 'src', 'docs', 'scss', 'main.scss'),
      ],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
      clean: true,
    },
    devServer: {
      watchFiles: {
        paths: WATCH_FILES_PATTERNS,
      },
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
      new RemoveEmptyScriptsPlugin(),
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'src', 'docs', 'www'),
            to: path.resolve(__dirname, 'dist'),
            transform: (content, filename) => {
              if (filename.endsWith('.html')) {
                return (new nunjucks.Environment(assetEmitterPlugin))
                    .renderPageFile(filename)
              }
              return content
            }
          }
        ]
      }),
      new WatchPlugin(),
      assetEmitterPlugin,
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
