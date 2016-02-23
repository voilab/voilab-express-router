/*jslint node: true, unparam: true, nomen: true */
(function () {
    'use strict';

    var Router = require('named-routes'),
        Voilab;

    Voilab = function () {
        this.nrouter = new Router();
        this.i18n = null;
    };

    Voilab.prototype = {
        setI18n: function (value) {
            this.i18n = value;
            return this;
        },

        getWebroot: function () {
            return this.webroot || '/';
        },

        extendExpress: function (app, i18n) {
            var methods = require('methods'), // retourne la liste des verbes HTTP reconnus par Node.js
                self = this;

            app.namedRoutes = this.nrouter;

            // pour chaque verbe HTTP, on va modifier sa signature et y ajouter la possibilité de le nommer
            methods.forEach(function (method) {
                var originalMethod = app[method];

                // redéfinition des verbes HTTP
                app[method] = function (name, path) {
                    var args = [].slice.call(arguments, 2),
                        lngs = null;

                    // name contient un ou des /, c'est donc un chemin déjà traité.
                    if (name.indexOf('/') !== -1) {
                        return originalMethod.apply(this, arguments);
                    }

                    // si on a reçu le module de gestion i18n, on va avoir 2-3 petits trucs de plus à tester...
                    if (typeof args[0] !== 'function') {
                        lngs = args.shift();
                    }

                    // La route est appelé sans path, qui sera déduit du nom.
                    if (self.i18n && i18n && typeof path === 'function') {
                        args.unshift(path);
                        path = '/:lng/routes|' + name;
                    }

                    // Middleware pour injecter le nom de la route dans res.locals et req.route.
                    args.unshift(function (req, res, next) {
                        req.route.name = res.locals.routename = name;
                        res.locals.reqParams = req.params;
                        next();
                    });

                    // Enregistrement du nom de la route
                    this.namedRoutes.add(method, path, [], {name: name});

                    if (self.i18n && i18n) {
                        return self.i18n.addRoute.apply(
                            self.i18n,
                            [
                                path,
                                lngs || self.i18n.options.supportedLngs || [],
                                app,
                                method
                            ].concat(args)
                        );
                    }

                    args.unshift(path);
                    return originalMethod.apply(this, args);
                };

                // application de notre redéfinition sur la méthode all() de express()
                app.all = function () {
                    var args = [].slice.call(arguments);

                    return methods.forEach(function (method) {
                        app[method].apply(app, args);
                    });
                };
            });
        },

        registerAppHelpers: function (app) {
            var lodash = require('lodash'),
                self = this;

            /**
             * Génération d'une URL complète pour la route donnée
             *
             * @param  {Object} req           Requête, utilisé pour trouver le hostname, protocol et port.
             * @param  {String} name          Nom de la route
             * @param  {Object} params        Paramètres de la route
             *
             * @return {String}               URL finale
             */
            app.locals.fullUrlI18n = function (req, name, params) {
                var url = app.locals.urlI18n(name, params);

                return req.protocol + '://' + req.headers.host + url;
            };

            app.locals.urlI18n = function (name, params, defaultParams) {
                params = params || {};
                lodash.defaults(params, defaultParams);
                params.lng = params.lng || self.i18n.lng();

                // le router voilab ne gère pas les routes en regexp. Il faut
                // cependant en tenir compte ici, via le name [raw]
                if (name === 'raw') {
                    if (!params.url && params.rawUrl) {
                        var url = lodash.trimStart(params.rawUrl, '/').split('/');
                        url.shift();
                        return '/' + params.lng + '/' + url.join('/');
                    }
                    return '/' + params.lng + params.url;
                }

                var route = self.nrouter.build(name, params),
                    parts = route.split('/'),
                    locRoute = [],
                    y,
                    ly,
                    part;

                for (y = 0, ly = parts.length; y < ly; y += 1) {
                    part = parts[y];
                    if (part.indexOf(':') === 0 || part === '') {
                        locRoute.push(part);
                    } else {
                        locRoute.push(self.i18n.t(part, { lng: params.lng }));
                    }
                }

                route = locRoute.join('/');
                return route;
            };

            return this;
        },

        /**
         * Créer une instance du routeur d'express et l'étend avec voilabrouter.
         *
         * @param {Bool} i18n par défaut, prend la valeur de this.i18n
         */
        Router: function (i18n) {
            var express = require('express'),
                router = express.Router(),
                self = this;

            if (i18n === undefined) {
                i18n = self.i18n;
            }
            self.extendExpress(router, i18n);

            return router;
        }
    };

    module.exports = Voilab;
}());
