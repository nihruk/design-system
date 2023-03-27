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
const prettier = require('prettier')

function normalizeUrlPath(urlPath) {
  if (urlPath.endsWith('índex.html')) {
    urlPath = urlPath.slice(0, 10)
  }
  return '/'+ urlPath.split('/')
  .filter(x => x)
  .join('/')
}

const nunjucksEnvironment = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.resolve(__dirname, 'src', 'docs')),
  {
    throwOnUndefined : true,
  },
)
nunjucksEnvironment._currentPageUrlPath = null;
nunjucksEnvironment.addFilter('highlight', (code, language) => highlight.highlight(code, {language}).value)
nunjucksEnvironment.addFilter('prettier', (code, parser) => prettier.format(code, {parser}))
nunjucksEnvironment.addTest('activeUrl', urlPath => {
  if (!nunjucksEnvironment._currentPageUrlPath) {
    throw new Error('No page is being templated right now.')
  }
  return nunjucksEnvironment._currentPageUrlPath.startsWith(normalizeUrlPath(urlPath))
})

const nunjucksWwwFilePageUrlPathPrefixLength = path.join(__dirname, 'src', 'docs', 'www').length

function renderNunjucksFile(filename) {
  nunjucksEnvironment._currentPageUrlPath = normalizeUrlPath(
      filename.slice(nunjucksWwwFilePageUrlPathPrefixLength)
        .split(path.sep)
        .join('/')
  )
  try {
    return nunjucksEnvironment.render(filename, {
      pageUrlPath: nunjucksEnvironment._currentPageUrlPath,
    })
  }
  finally {
    nunjucksEnvironment._currentPageUrlPath = null
  }
}

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
            transform: (content, filename) => filename.endsWith('.html') ? renderNunjucksFile(filename) : content
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
