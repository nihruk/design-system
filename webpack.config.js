const path = require('path');
const webpack = require('webpack');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const nunjucks = require('nunjucks');
const postcssPresetEnv = require('postcss-preset-env');
const highlight = require('highlight.js');
const prettier = require('prettier');

const nunjucksEnvironment = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.resolve(__dirname, 'src', 'docs')),
  {
    throwOnUndefined : true,
  },
)
nunjucksEnvironment.addFilter('highlight', (code, language) => highlight.highlight(code, {language}).value)
nunjucksEnvironment.addFilter('prettier', (code, parser) => prettier.format(code, {parser}))

module.exports = (env, args) => {
  const production = args.mode === 'production'
  const configuration = {
    entry: {
      'design-system': [
          path.resolve(__dirname, 'src', 'assets', 'scss', 'libs.scss'),
          path.resolve(__dirname, 'src', 'assets', 'js', 'theme.js'),
          path.resolve(__dirname, 'src', 'assets', 'scss', 'theme.scss'),
      ],
      'docs': [
          path.resolve(__dirname, 'src', 'docs', 'scss', 'main.scss'),
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
            transform: (content, filename) => filename.endsWith('.html') ? nunjucksEnvironment.render(filename) : content
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
