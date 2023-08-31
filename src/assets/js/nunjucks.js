'use strict'

const stdNunjucks = require('nunjucks')
const path = require('path')
const {SafeString} = require('nunjucks/src/runtime')

class Environment extends stdNunjucks.Environment {
    constructor(loaders = [], opts = {}) {
        super(
            [
                ...loaders,
                new stdNunjucks.FileSystemLoader(path.resolve(__dirname, '..', '..')),
            ],
            {
                noCache: true,
                throwOnUndefined: true,
                ...opts,
            }
        )
        const environment = this
        this._lastGeneratedId = 0
        this._currentPageUrlPath = null;
        this.addGlobal('generateId', () => environment.generateId())
        const filterHtmlAttributeValue = (value) => {
            if (value === null) {
                return false
            }
            if (typeof value !== 'string') {
                return false
            }
            if (value.trim() === '') {
                return false
            }
            return true
        }
        this.addFilter('htmlAttributes', attributes => {
            let renderedAttributes = ' '
            for (let [name, value] of Object.entries(attributes)) {
                if (!filterHtmlAttributeValue(value)) {
                    if (!Array.isArray(value)) {
                        continue
                    }
                    value = value.filter(filterHtmlAttributeValue).join(' ')
                    if (!value) {
                        continue
                    }
                }
                renderedAttributes += ` ${name}="${value}"`
            }
            return new SafeString(renderedAttributes.trimEnd())
        })
        this.addTest('activeCurrentUrl', urlPath => {
            if (!environment.currentPageUrlPath) {
                throw new Error('No page is being templated right now.')
            }
            return environment.currentPageUrlPath === environment.normalizeUrlPath(urlPath)
        })
        this.addTest('activeParentUrl', urlPath => {
            if (!environment.currentPageUrlPath) {
                throw new Error('No page is being templated right now.')
            }
            return environment.currentPageUrlPath.startsWith(environment.normalizeUrlPath(urlPath))
        })
    }

    generateId() {
        return 'ds-id-' + this._lastGeneratedId++
    }

    get currentPageUrlPath() {
        return this._currentPageUrlPath
    }

    set currentPageUrlPath(path) {
        this._currentPageUrlPath = this.normalizeUrlPath(path)
    }

    normalizeUrlPath(urlPath) {
        if (urlPath.endsWith('index.html')) {
            urlPath = urlPath.slice(0, -10)
        }
        return '/' + urlPath.split('/')
            .filter(x => x)
            .join('/')
    }
}

module.exports = {
    Environment,
}
