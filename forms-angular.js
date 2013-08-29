/*! forms-angular 2013-08-21 */
'use strict';

var formsAngular = angular.module('formsAngular', [
	  'ngRoute'
    , 'ngSanitize'
    , 'ui.select2'
    , 'ui.date'
    , 'fng.ui.bootstrap'
    , 'ui.bootstrap'
]);

// Ideally would want a config call in here which adds the routes, below, but couldn't get it to work
//    when('/:model/:id/edit', {templateUrl: 'partials/base-edit.html', controller: "BaseCtrl"}).
//    when('/:model/new', {templateUrl: 'partials/base-edit.html', controller: "BaseCtrl"}).
//    when('/:model', {templateUrl: 'partials/base-list.html', controller: "BaseCtrl"}).
//    when('/:model/:form/:id/edit', {templateUrl: 'partials/base-edit.html', controller: "BaseCtrl"}).  // non default form (different fields etc)
//    when('/:model/:form/new', {templateUrl: 'partials/base-edit.html', controller: "BaseCtrl"}).       // non default form (different fields etc)
//    when('/:model/:form', {templateUrl: 'partials/base-list.html', controller: "BaseCtrl"}).           // list page with links to non default form

formsAngular.value('ui.config', {
    date: {
        dateFormat: 'dd/mm/yy'
    }
});

formsAngular.controller('BaseCtrl', ['$scope', '$routeParams', '$location', '$http', '$filter', '$data', '$locationParse', '$dialog', function ($scope, $routeParams, $location, $http, $filter, $data, $locationParse, $dialog) {
    var master = {};
    var fngInvalidRequired = 'fng-invalid-required';
    var sharedStuff = $data;
    $scope.record = sharedStuff.record;
    $scope.disableFunctions = sharedStuff.disableFunctions;
    $scope.dataEventFunctions = sharedStuff.dataEventFunctions;
    $scope.formSchema = [];
    $scope.panes = [];
    $scope.listSchema = [];
    $scope.recordList = [];
    $scope.dataDependencies = {};
    $scope.select2List = [];

    angular.extend($scope, $locationParse($location.$$path));

    $scope.formPlusSlash = $scope.formName ? $scope.formName + '/' : '';
    $scope.modelNameDisplay = $filter('titleCase')($scope.modelName);

    function updateInvalidClasses(value, id, select2) {
        var target = '#' + ((select2) ? 'cg_' : '') + id;
        if (value) {
            $(target).removeClass(fngInvalidRequired);
        } else {
            $(target).addClass(fngInvalidRequired);
        }
    }

    var suffixCleanId = function (inst, suffix) {
        return inst.id.replace(/\./g, '_') + suffix;
    };

    var handleFieldType = function (formInstructions, mongooseType, mongooseOptions) {

        var select2ajaxName;
        if (mongooseType.caster) {
            formInstructions.array = true;
            mongooseType = mongooseType.caster;
            $.extend(mongooseOptions, mongooseType.options)
        }
        if (mongooseType.instance == 'String') {
            if (mongooseOptions.enum) {
                formInstructions.type = 'select';
                // Hacky way to get required styling working on select controls
                if (mongooseOptions.required) {

                    $scope.$watch('record.'+formInstructions.name, function (newValue) {
                        updateInvalidClasses(newValue, formInstructions.id, formInstructions.select2);
                    }, true);
                    setTimeout(function() { updateInvalidClasses($scope.record[formInstructions.name],formInstructions.id, formInstructions.select2);
                    },0)
                }
                if (formInstructions.select2) {
                    $scope['select2'+formInstructions.name] = {
                        allowClear: !mongooseOptions.required,
                        initSelection: function(element, callback) {
                            var myVal = element.val();
                            var display = {id: myVal, text: myVal};
                            callback(display);
                        },
                        query: function (query) {
                            var data = {results: []},
                                searchString = query.term.toUpperCase();
                            for (var i = 0; i < mongooseOptions.enum.length ; i++) {
                                if (mongooseOptions.enum[i].toUpperCase().indexOf(searchString) !== -1) {
                                    data.results.push({id: i, text: mongooseOptions.enum[i]})
                                }
                            }
                            query.callback(data);
                        }
                    };
                    _.extend($scope['select2'+formInstructions.name], formInstructions.select2);
                    formInstructions.select2.s2query = 'select2'+formInstructions.name;
                    $scope.select2List.push(formInstructions.name)
                } else {
                    formInstructions.options = suffixCleanId(formInstructions, 'Options');
                    $scope[formInstructions.options] = mongooseOptions.enum;
                }
            } else if (!formInstructions.type) {
                var passwordOverride, isPassword;
                if (mongooseOptions.form) {
                    passwordOverride = mongooseOptions.form.password
                }
                if (passwordOverride !== undefined) {
                    isPassword = passwordOverride;
                } else {
                    isPassword = (formInstructions.name.toLowerCase().indexOf('password') !== -1)
                }
                formInstructions.type = isPassword ? 'password' : 'text';
            }
        } else if (mongooseType.instance == 'ObjectID') {
            formInstructions.ref = mongooseOptions.ref;
            if (formInstructions.link && formInstructions.link.linkOnly) {
                formInstructions.type = 'link';
                formInstructions.linkText = formInstructions.link.text;
                delete formInstructions.link;
            } else {
                formInstructions.type = 'select';
                if (formInstructions.select2) {
                    $scope.select2List.push(formInstructions.name);
                    if (formInstructions.select2.fngAjax) {
                        // create the instructions for select2
                        select2ajaxName = 'ajax' + formInstructions.name.replace(/\./g,'');
                        $scope[select2ajaxName] = {
                            allowClear: !mongooseOptions.required,
                            minimumInputLength: 2,
                            initSelection : function (element, callback) {
                                $http.get('api/' + mongooseOptions.ref + '/' +element.val() + '/list').success(function (data) {
                                    if (data.success === false) {
                                        $location.path("/404");
                                    }
                                    var display = {id: element.val(), text: data.list};
                                    master[formInstructions.name] = display;
                                    callback(display);

                                }).error(function () {
                                        $location.path("/404");
                                    });
                            },
                            ajax: {
                                url: "/api/search/" + mongooseOptions.ref,
                                data: function (term, page) { // page is the one-based page number tracked by Select2
                                    return {
                                        q: term, //search term
                                        page_limit: 10, // page size
                                        page: page // page number
                                    }
                                },
                                results: function (data) {
                                    return {results: data.results, more: data.moreCount > 0};
                                }
                            }
                        };
                        _.extend($scope[select2ajaxName], formInstructions.select2);
                        formInstructions.select2.fngAjax = select2ajaxName;
                    } else {
                        if (formInstructions.select2 == true) {
                            formInstructions.select2 = {};
                        }
                        $scope['select2'+formInstructions.name] = {
                            allowClear: !mongooseOptions.required,
                            initSelection: function(element, callback) {
                                var myId,
                                    myVal = element.val();
                                if ($scope[formInstructions.options].length > 0) {
                                    myId = convertListValueToId(myVal, $scope[formInstructions.options], $scope[formInstructions.ids], formInstructions.name)
                                } else {
                                    myId = myVal;
                                }
                                var display = {id: myId, text: myVal};
                                callback(display);
                            },
                            query: function (query) {
                                var data = {results: []},
                                    searchString = query.term.toUpperCase();
                                for (var i = 0; i < $scope[formInstructions.options].length ; i++) {
                                    if ($scope[formInstructions.options][i].toUpperCase().indexOf(searchString) !== -1) {
                                        data.results.push({id: $scope[formInstructions.ids][i], text: $scope[formInstructions.options][i]})
                                    }
                                }
                                query.callback(data);
                            }
                        };
                        _.extend($scope['select2'+formInstructions.name], formInstructions.select2);
                        formInstructions.select2.s2query = 'select2'+formInstructions.name;
                        $scope.select2List.push(formInstructions.name);
                        formInstructions.options = suffixCleanId(formInstructions, 'Options');
                        formInstructions.ids = suffixCleanId(formInstructions, '_ids');
                        setUpSelectOptions(mongooseOptions.ref, formInstructions);
                    }
                } else {
                    formInstructions.options = suffixCleanId(formInstructions, 'Options');
                    formInstructions.ids = suffixCleanId(formInstructions, '_ids');
                    setUpSelectOptions(mongooseOptions.ref, formInstructions);
                }
            }
        } else if (mongooseType.instance == 'Date') {
            formInstructions.type = 'text';
            formInstructions.add = 'ui-date ui-date-format ';
        } else if (mongooseType.instance == 'boolean') {
            formInstructions.type = 'checkbox';
        } else if (mongooseType.instance == 'Number') {
            formInstructions.type = 'number';
        } else {
            throw new Error("Field " + formInstructions.name + " is of unsupported type " + mongooseType.instance);
        }
        if (mongooseOptions.required) {
            formInstructions.required = true;
        }
        if (mongooseOptions.readonly) {
            formInstructions.readonly = true;
        }
        return formInstructions;
    };

    var basicInstructions = function (field, formData, prefix) {
        formData.name = prefix + field;
        formData.id = formData.id || 'f_' + prefix + field;
        formData.label = (formData.hasOwnProperty('label') && formData.label) == null ? '' : (formData.label || $filter('titleCase')(field));
        return formData;
    };

    var handleListInfo = function (destList, listOptions, field) {
        var listData = listOptions || {hidden: true};
        if (!listData.hidden) {
            if (typeof listData == "object") {
                listData.name = field;
                destList.push(listData);
            } else {
                destList.push({name: field});
            }
        }
    };

    var handleEmptyList = function (description, destList, destForm, source) {
        // If no list fields specified use the first non hidden string field
        if (destForm) {
            for (var i = 0, l = destForm.length; i < l; i++) {
                if (destForm[i].type == 'text') {
                    destList.push({name: destForm[i].name});
                    break;
                }
            }
            if (destList.length === 0 && destForm.length !== 0) {
                // If it is still blank then just use the first field
                destList.push({name: destForm[0].name});
            }
        }

        if (destList.length === 0) {
            // If it is still blank then just use the first field from source
            for (var field in source) {
                if (field !== '_id' && source.hasOwnProperty(field)) {
                    destList.push({name: field});
                    break;
                }
            }
            if (destList.length === 0) {
                throw new Error("Unable to generate a title for " + description)
            }
        }
    };

    var evaluateConditional = function (condition, data) {

        function evaluateSide(side) {
            var result = side;
            if (typeof side === "string" && side.slice(0, 1) === '$') {
                result = $scope.getListData(data, side.slice(1))
            }
            return result;
        }

        var lhs = evaluateSide(condition.lhs)
            , rhs = evaluateSide(condition.rhs)
            , result;

        switch (condition.comp) {
            case 'eq' :
                result = (lhs === rhs);
                break;
            case 'ne' :
                result = (lhs !== rhs);
                break;
            default :
                throw new Error("Unsupported comparator " + condition.comp);
        }
        return result;
    };

//    Conditionals
//    $scope.dataDependencies is of the form {fieldName1: [fieldId1, fieldId2], fieldName2:[fieldId2]}

    var handleConditionals = function (condInst, id) {

        var dependency = 0;

        function handleVar(theVar) {
            if (typeof theVar === "string" && theVar.slice(0, 1) === '$') {
                var fieldName = theVar.slice(1);
                var fieldDependencies = $scope.dataDependencies[fieldName] || [];
                fieldDependencies.push(id);
                $scope.dataDependencies[fieldName] = fieldDependencies;
                dependency += 1;
            }
        }

        var display = true;
        if (condInst) {
            handleVar(condInst.lhs);
            handleVar(condInst.rhs);
            if (dependency === 0 && !evaluateConditional(condInst)) {
                display = false;
            }
        }
        return display;
    };

    // TODO: Think about nested arrays
    // This doesn't handle things like :
    // {a:"hhh",b:[{c:[1,2]},{c:[3,4]}]}
    $scope.getListData = function (record, fieldName) {
        var nests = fieldName.split('.');
        for (var i = 0; i < nests.length; i++) {
            if (record !== undefined) {
                record = record[nests[i]];
            }
        }
        if (record && $scope.select2List.indexOf(nests[i-1]) !== -1) {
            record = record.text;
        }
        if (record === undefined) {
            record = "";
        }
        return record;
    };

    $scope.updateDataDependentDisplay = function (curValue, oldValue, force) {
        for (var field in $scope.dataDependencies) {
            if ($scope.dataDependencies.hasOwnProperty(field) && (force || (curValue[field] != oldValue[field]))) {
                var depends = $scope.dataDependencies[field];
                for (var i = 0; i < depends.length; i += 1) {
                    var id = depends[i];
                    for (var j = 0; j < $scope.formSchema.length; j += 1) {
                        if ($scope.formSchema[j].id === id) {
                            var control = $('#cg_' + id);
                            if (evaluateConditional($scope.formSchema[j].showIf, curValue)) {
                                control.show();
                            } else {
                                control.hide();
                            }
                        }
                    }
                }
            }
        }
    };

    var handleSchema = function (description, source, destForm, destList, prefix, doRecursion) {

        function handlePaneInfo(paneName, thisInst) {
            var paneTitle = angular.copy(paneName);
            var pane = _.find($scope.panes, function (aPane) {
                return aPane.title === paneTitle
            });
            if (!pane) {
                var active = false;
                if ($scope.panes.length === 0) {
                    if ($scope.formSchema.length > 0) {
                        $scope.panes.push({title: 'Main', content: [], active: true});
                        pane = $scope.panes[0];
                        for (var i = 0; i < $scope.formSchema.length; i++) {
                            pane.content.push($scope.formSchema[i])
                        }
                    } else {
                        active = true;
                    }
                }
                pane = $scope.panes[$scope.panes.push({title: paneTitle, content: [], active: active}) - 1]
            }
            pane.content.push(thisInst);
        }

        for (var field in source) {
            if (field !== '_id' && source.hasOwnProperty(field)) {
                var mongooseType = source[field],
                    mongooseOptions = mongooseType.options || {};
                var formData = mongooseOptions.form || {};
                if (!formData.hidden) {
                    if (mongooseType.schema) {
                        if (doRecursion && destForm) {
                            var schemaSchema = [];
                            handleSchema('Nested ' + field, mongooseType.schema, schemaSchema, null, field + '.', true);
                            var sectionInstructions = basicInstructions(field, formData, prefix);
                            sectionInstructions.schema = schemaSchema;
                            if (formData.pane) handlePaneInfo(formData.pane, sectionInstructions);
                            destForm.push(sectionInstructions);
                        }
                    } else {
                        if (destForm) {
                            var formInstructions = basicInstructions(field, formData, prefix);
                            if (handleConditionals(formInstructions.showIf, formInstructions.id)) {
                                var formInst = handleFieldType(formInstructions, mongooseType, mongooseOptions);
                                if (formInst.pane) handlePaneInfo(formInst.pane, formInst);
                                destForm.push(formInst);
                            }
                        }
                        if (destList) {
                            handleListInfo(destList, mongooseOptions.list, field);
                        }
                    }
                }
            }
        }
        if (destList && destList.length === 0) {
            handleEmptyList(description, destList, destForm, source);
        }
    };

    $scope.readRecord = function() {
        $http.get('api/' + $scope.modelName + '/' + $scope.id).success(function (data) {
            if (data.success === false) {
                $location.path("/404");
            }
            if (typeof $scope.dataEventFunctions.onAfterRead === "function") {
                $scope.dataEventFunctions.onAfterRead(data);
            }
            master = convertToAngularModel($scope.formSchema, data, 0);
            $scope.cancel();
        }).error(function () {
            $location.path("/404");
        });
    };

    $http.get('api/schema/' + $scope.modelName + ($scope.formName ? '/' + $scope.formName : ''),{cache:true}).success(function (data) {

        handleSchema('Main ' + $scope.modelName, data, $scope.formSchema, $scope.listSchema, '', true);

        if (!$scope.id && !$scope.newRecord) { //this is a list. listing out contents of a collection
            var connector = '?';
            var queryString = '';
            if ($routeParams.f) {
                queryString += connector + 'f=' + $routeParams.f;
                connector = '&';
            }
            if ($routeParams.a) {
                queryString += connector + 'a=' + $routeParams.a;
            }
            $http.get('api/' + $scope.modelName + queryString).success(function (data) {
                $scope.recordList = data;
            }).error(function () {
                    $location.path("/404");
                });
        } else {
            $scope.$watch('record', function (newValue, oldValue) {
                $scope.updateDataDependentDisplay(newValue, oldValue, false)
            }, true);

            if ($scope.id) {
                // Going to read a record
                if (typeof $scope.dataEventFunctions.onBeforeRead === "function") {
                    $scope.dataEventFunctions.onBeforeRead($scope.id, function(err) {
                        if (err) {
                            showError(err);
                        } else {
                            $scope.readRecord();
                        }
                    });
                } else {
                    $scope.readRecord();
                }
            } else {
                master = {};
                $scope.cancel();
            }
        }
    }).error(function () {
            $location.path("/404");
        });

    $scope.cancel = function () {
        // would like to do
        //        $scope.record = angular.copy(master);
        // but the data may be shared

        function copyObject(to, from) {
            var prop;

            for (prop in to) {
                if (to.hasOwnProperty(prop)) {
                    delete to[prop];
                }
            }
            for (prop in from) {
                if (from.hasOwnProperty(prop)) {
                    if (_.isObject(from[prop]) && !_.isArray(from[prop])) {
                        to[prop] = {};
                        copyObject(to[prop],from[prop]);
                    } else {
                        to[prop] = from[prop];
                    }
                }
            }
        }

        copyObject($scope.record, master);
        $scope.dismissError();

// TODO: Sort all this pristine stuff
//        if ($scope.myForm) {
//            console.log('Calling set pristine')
//            $scope.myForm.$setPristine();
//        } else {
//            console.log("No form");
//        }
    };

//    window.onbeforeunload = function() {
//        if ($('.ng-dirty').length > 0) {
//            return 'You have unsaved changes!';
//        } else {
//            return null;
//        }
//    }

//    $scope.$on('$locationChangeStart', function (event, next, current) {
//        console.log('changed = ' + $scope.isCancelDisabled())
////        event.preventDefault();
////        if ( !$scope.isCancelDisabled() && ! confirm("Are you sure you want to leave this page?") ) {
////            event.preventDefault();
////        }
//    });

    var handleError = function (data, status) {
        if ([200, 400].indexOf(status) !== -1) {
            var errorMessage = '';
            for (var errorField in data.errors) {
                if (data.errors.hasOwnProperty(errorField)) {
                    errorMessage += '<li><b>'+ $filter('titleCase')(errorField) +': </b> ';
                    switch (data.errors[errorField].type) {
                        case 'enum' :
                            errorMessage += 'You need to select from the list of values';
                            break;
                        default:
                            errorMessage += data.errors[errorField].message;
                            break;
                    }
                   errorMessage += '</li>'
                }
            }
            if (errorMessage.length > 0) {
                errorMessage = data.message + '<br /><ul>' + errorMessage + '</ul>';
            } else {
                errorMessage = data.message || "Error!  Sorry - No further details available.";
            }
            showError(errorMessage);
        } else {
            showError(status + ' ' + JSON.stringify(data));
        }
    };

    var showError = function (errString, alertTitle) {
        $scope.alertTitle = alertTitle ? alertTitle : "Error!";
        $scope.errorMessage = errString;
    };

    $scope.dismissError = function () {
        delete $scope.errorMessage;
    };

    $scope.createNew = function(dataToSave, options) {
        $http.post('api/' + $scope.modelName, dataToSave).success(function (data) {
            if (data.success !== false) {
                if (typeof $scope.dataEventFunctions.onAfterCreate === "function") {
                    $scope.dataEventFunctions.onAfterCreate(data);
                }
                if (options.redirect) {
                    window.location = options.redirect
                } else {
                    $location.path('/' + $scope.modelName + '/' + $scope.formPlusSlash + data._id + '/edit');
                    //                    reset?
                }
            } else {

                console.log(data);
                showError(data);
            }
        }).error(handleError);
    }

    $scope.updateDocument = function(dataToSave, options) {
        $http.post('api/' + $scope.modelName + '/' + $scope.id, dataToSave).success(function (data) {
            if (data.success !== false) {
                if (typeof $scope.dataEventFunctions.onAfterUpdate === "function") {
                    $scope.dataEventFunctions.onAfterUpdate(data,master)
                }
                if (options.redirect) {
                    window.location = options.redirect;
                } else {
                    master = angular.copy($scope.record);
                    $scope.dismissError();
//                  Alternatively we could copy data into master and update all look ups and then call cancel (which calls dismissError).
//                  This is harder and I can't currently see the need.
                }
            } else {
                showError(data);
            }
        }).error(handleError);

    }

    $scope.save = function (options) {
        options = options || {};

        //Convert the lookup values into ids
        var dataToSave = convertToMongoModel($scope.formSchema, angular.copy($scope.record), 0);
        if ($scope.id) {
            if (typeof $scope.dataEventFunctions.onBeforeUpdate === "function") {
                $scope.dataEventFunctions.onBeforeUpdate(dataToSave, master, function(err) {
                    if (err) {
                        showError(err);
                    } else {
                        $scope.updateDocument(dataToSave, options);
                    }
                })
            } else {
                $scope.updateDocument(dataToSave, options);
            }
        } else {
            if (typeof $scope.dataEventFunctions.onBeforeCreate === "function") {
                $scope.dataEventFunctions.onBeforeCreate(dataToSave, function(err) {
                    if (err) {
                        showError(err);
                    } else {
                        $scope.createNew(dataToSave, options);
                    }
                })
            } else {
                $scope.createNew(dataToSave, options);
            }
        }
    };

    $scope.new = function () {
        $location.search("");
        $location.path('/' + $scope.modelName + '/' + $scope.formPlusSlash + 'new');
    };

    $scope.deleteRecord = function(model, id) {
        $http.delete('api/' + model + '/' + id).success(function() {
            if (typeof $scope.dataEventFunctions.onAfterDelete === "function") {
                $scope.dataEventFunctions.onAfterDelete(master);
            }
            $location.path('/' + $scope.modelName);
        });
    }


    $scope.delete = function() {

        var boxResult;

        if ($scope.record._id) {

            var msgBox = $dialog.messageBox('Delete Item', 'Are you sure you want to delete this record?', [{
                label: 'Yes',
                result: 'yes'
            }, {
                label: 'No',
                result: 'no'
            }]);

            msgBox.open().then(function(result) {

                if (result === 'yes') {

                    if (typeof $scope.dataEventFunctions.onBeforeDelete === "function") {
                            $scope.dataEventFunctions.onBeforeDelete(master, function(err) {

                                if (err) {
                                    showError(err);
                                } else {

                                    $scope.deleteRecord($scope.modelName, $scope.id);
                                    
                               }

                            });
                        } else {

                            $scope.deleteRecord($scope.modelName, $scope.id);

                        }

                    
                }

                if (result === 'no') {
                    boxResult = result;
                };
            });
            //can't close the msxBox from within itself as it breaks it.
            if (boxResult === 'no') {
                msgBox.close();
            }
        }
    };


    $scope.isCancelDisabled = function () {
        if (typeof $scope.disableFunctions.isCancelDisabled === "function") {
            return $scope.disableFunctions.isCancelDisabled($scope.record, master, $scope.myForm);
        } else {
            return angular.equals(master, $scope.record) ;
        }
    };

    $scope.isSaveDisabled = function () {
        if (typeof $scope.disableFunctions.isSaveDisabled === "function") {
            return $scope.disableFunctions.isSaveDisabled($scope.record, master, $scope.myForm);
        } else {
            return $scope.myForm.$invalid || angular.equals(master, $scope.record);
        }
    };

    $scope.isDeleteDisabled = function () {
        if (typeof $scope.disableFunctions.isDeleteDisabled === "function") {
            return $scope.disableFunctions.isDeleteDisabled($scope.record, master, $scope.myForm);
        } else {
            return false;
        }
    };

    $scope.isNewDisabled = function () {
        if (typeof $scope.disableFunctions.isNewDisabled === "function") {
            return $scope.disableFunctions.isNewDisabled($scope.record, master, $scope.myForm);
        } else {
            return false;
        }
    };

    $scope.disabledText = function (localStyling) {
        var text = "";
        if ($scope.isSaveDisabled) {
            text = "This button is only enabled when the form is complete and valid.  Make sure all required inputs are filled in. " + localStyling
        }
        return text;
    };

    $scope.add = function (elementInfo) {
        var fieldName = elementInfo.field.name, arrayField;
        var fieldParts = fieldName.split('.');
        arrayField = $scope.record;
        for (var i = 0, l = fieldParts.length; i < l; i++) {
            if (!arrayField[fieldParts[i]]) {
                if (i === l - 1) {
                    arrayField[fieldParts[i]] = [];
                } else {
                    arrayField[fieldParts[i]] = {};
                }
            }
            arrayField = arrayField[fieldParts[i]];
        }
        arrayField.push({});
    };

    $scope.remove = function (fieldInfo, value) {
        // Remove an element from an array
        var fieldName = fieldInfo.$parent.field.name;
        var fieldParts = fieldName.split('.');
        var arrayField = $scope.record;
        for (var i = 0, l = fieldParts.length; i < l; i++) {
            arrayField = arrayField[fieldParts[i]];
        }
        arrayField.splice(value, 1);
    };

// Split a field name into the next level and all following levels
    function splitFieldName(aFieldName) {
        var nesting = aFieldName.split('.'),
            result = [nesting[0]];

        if (nesting.length > 1) {
            result.push(nesting.slice(1).join('.'));
        }

        return result;
    }

    function updateObject(aFieldName, portion, fn) {
        var fieldDetails = splitFieldName(aFieldName);

        if (fieldDetails.length > 1) {
            updateArrayOrObject(fieldDetails[1], portion[fieldDetails[0]], fn);
        } else if (portion[fieldDetails[0]]) {
            var theValue = portion[fieldDetails[0]];
            portion[fieldDetails[0]] = fn((typeof theValue === 'Object') ? theValue.x : theValue)
        }
    }

    function updateArrayOrObject(aFieldName, portion, fn) {
        if (portion !== undefined) {
            if ($.isArray(portion)) {
                for (var i = 0; i < portion.length; i++) {
                    updateObject(aFieldName, portion[i], fn);
                }
            } else {
                updateObject(aFieldName, portion, fn);
            }
        }
    }


// Convert {_id:'xxx', array:['item 1'], lookup:'012abcde'} to {_id:'xxx', array:[{x:'item 1'}], lookup:'List description for 012abcde'}
// Which is what we need for use in the browser
    var convertToAngularModel = function (schema, anObject, prefixLength) {
        for (var i = 0; i < schema.length; i++) {
            var fieldname = schema[i].name.slice(prefixLength);
            if (schema[i].schema) {
                if (anObject[fieldname]) {
                    for (var j = 0; j < anObject[fieldname].length; j++) {
                        anObject[fieldname][j] = convertToAngularModel(schema[i].schema, anObject[fieldname][j], prefixLength + 1 + fieldname.length);
                    }
                }
            } else {

                // Convert {array:['item 1']} to {array:[{x:'item 1'}]}
                if (schema[i].array && schema[i].type == 'text' && anObject[fieldname]) {
                    for (var k = 0; k < anObject[fieldname].length; k++) {
                        anObject[fieldname][k] = {x: anObject[fieldname][k]}
                    }
                }

                // Convert {lookup:'012abcde'} to {lookup:'List description for 012abcde'}
                var idList = $scope[suffixCleanId(schema[i], '_ids')];
                if (idList && idList.length > 0 && anObject[fieldname]) {
                    anObject[fieldname] = convertForeignKeys(schema[i], anObject[fieldname], $scope[suffixCleanId(schema[i], 'Options')], idList);
                } else if (schema[i].select2 && !schema[i].select2.fngAjax) {
                    if (anObject[fieldname]) {
                        // Might as well use the function we set up to do the search
                        $scope[schema[i].select2.s2query].query({
                            term: anObject[fieldname],
                            callback: function (array) {
                                if (array.results.length > 0) {
                                    anObject[fieldname] = array.results[0];
                                }
                            }});
                    }
                }
            }
        }
        return anObject;
    };

// Reverse the process of convertToAngularModel
    var convertToMongoModel = function (schema, anObject, prefixLength) {

        for (var i = 0; i < schema.length; i++) {
            var fieldname = schema[i].name.slice(prefixLength);
            if (schema[i].schema) {
                var thisField = $scope.getListData(anObject, fieldname);
                if (thisField) {
                    for (var j = 0; j < thisField.length; j++) {
                        thisField[j] = convertToMongoModel(schema[i].schema, thisField[j], prefixLength + 1 + fieldname.length);
                    }
                }
            } else {

                // Convert {array:[{x:'item 1'}]} to {array:['item 1']}
                if (schema[i].array && schema[i].type == 'text' && anObject[fieldname]) {
                    for (var k = 0; k < anObject[fieldname].length; k++) {
                        anObject[fieldname][k] = anObject[fieldname][k].x
                    }
                }

                // Convert {lookup:'List description for 012abcde'} to {lookup:'012abcde'}
                var idList = $scope[suffixCleanId(schema[i], '_ids')];
                if (idList && idList.length > 0) {
                    updateObject(fieldname, anObject, function (value) {
                        return( convertToForeignKeys(schema[i], value, $scope[suffixCleanId(schema[i], 'Options')], idList) );
                    });
                } else if (schema[i].select2) {
                    if (schema[i].select2.fngAjax) {
                        if (anObject[fieldname]) {
                            anObject[fieldname] = anObject[fieldname].id;
                        }
                    } else {
                        if (anObject[fieldname]) {
                            anObject[fieldname] = anObject[fieldname].text;
                        } else {
                            delete anObject[fieldname];
                        }
                    }
                }

            }
        }
        return anObject;
    };


// Convert foreign keys into their display for selects
// Called when the model is read and when the lookups are read

// No support for nested schemas here as it is called from convertToAngularModel which does that
    function convertForeignKeys(schemaElement, input, values, ids) {
        if (schemaElement.array) {
            var returnArray = [];
            for (var j = 0; j < input.length; j++) {
                returnArray.push({x: convertIdToListValue(input[j], ids, values, schemaElement.name)});
            }
            return returnArray;
        } else {
            return convertIdToListValue(input, ids, values, schemaElement.name);
        }
    }

// Convert ids into their foreign keys
// Called when saving the model

// No support for nested schemas here as it is called from convertToMongoModel which does that
    function convertToForeignKeys(schemaElement, input, values, ids) {
        if (schemaElement.array) {
            var returnArray = [];
            for (var j = 0; j < input.length; j++) {
                returnArray.push(convertListValueToId(input[j], values, ids, schemaElement.name));
            }
            return returnArray;
        } else {
            return convertListValueToId(input, values, ids, schemaElement.name);
        }
    }

    var convertIdToListValue = function (id, idsArray, valuesArray, fname) {
        var index = idsArray.indexOf(id);
        if (index === -1) {
            throw new Error("convertIdToListValue: Invalid data - id " + id + " not found in " + idsArray + " processing " + fname)
        }
        return valuesArray[index];
    };

    var convertListValueToId = function (value, valuesArray, idsArray, fname) {
        var textToConvert = _.isObject(value) ? value.x : value;
        if (textToConvert && textToConvert.match(/^[0-9a-f]{24}$/)) {
            return(textToConvert);  // a plugin probably added this
        } else {
            var index = valuesArray.indexOf(textToConvert);
            if (index === -1) {
                throw new Error("convertListValueToId: Invalid data - value " + textToConvert + " not found in " + valuesArray + " processing " + fname)
            }
            return idsArray[index];
        }
    };

    var setUpSelectOptions = function (lookupCollection, schemaElement) {
        var optionsList = $scope[schemaElement.options] = [];
        var idList = $scope[schemaElement.ids] = [];
        $http.get('api/schema/' + lookupCollection,{cache : true}).success(function (data) {
            var listInstructions = [];
            handleSchema('Lookup ' + lookupCollection, data, null, listInstructions, '', false);
            $http.get('api/' + lookupCollection, {cache: true}).success(function (data) {
                if (data) {
                    for (var i = 0; i < data.length; i++) {
                        var option = '';
                        for (var j = 0; j < listInstructions.length; j++) {
                            option += data[i][listInstructions[j].name] + ' ';
                        }
                        option = option.trim();
                        var pos = _.sortedIndex(optionsList, option);
                        optionsList.splice(pos, 0, option);
                        idList.splice(pos, 0, data[i]._id);
                    }
                    updateRecordWithLookupValues(schemaElement);
                }
            })
        })
    };

    var updateRecordWithLookupValues = function (schemaElement) {
        // Update the master and the record with the lookup values
        if (angular.equals(master[schemaElement.name], $scope.record[schemaElement.name]) ||
            (schemaElement.select2 && angular.equals(master[schemaElement.name], $scope.record[schemaElement.name].text))) {
            updateObject(schemaElement.name, master, function (value) {
                return( convertForeignKeys(schemaElement, value, $scope[suffixCleanId(schemaElement, 'Options')], $scope[suffixCleanId(schemaElement, '_ids')]));
            });
            // TODO This needs a rethink - it is a quick workaround.  See https://trello.com/c/q3B7Usll
            if (master[schemaElement.name]) {
                $scope.record[schemaElement.name] = master[schemaElement.name];
            }
            // TODO Reintroduce after conversion to Angular 1.1+ and introduction of ng-if
//        } else {
//            throw new Error("Record has been changed from "+master[schemaElement.name]+" to "+ $scope.record[schemaElement.name] +" in lookup "+schemaElement.name+".  Cannot convert.")
        }
    };

    // Open a select2 control from the appended search button
    $scope.openSelect2 = function(ev) {
        $('#' + $(ev.currentTarget).data('select2-open')).select2('open')
    };

}]);

formsAngular.controller('ModelCtrl', [ '$scope', '$http', '$location', function ($scope, $http, $location) {

    $scope.models = [];
    $http.get('api/models').success(function (data) {
        $scope.models = data;
    }).error(function () {
            $location.path("/404");
    });

}]);

'use strict';

formsAngular.controller('NavCtrl',['$scope', '$location', '$filter', '$locationParse', '$controller', function($scope, $location, $filter, $locationParse, $controller) {

    $scope.items = [];

    function loadMenu(controllerName, level) {
        var locals={}, addThis;

        controllerName += 'Ctrl';
        locals.$scope = $scope.scopes[level] = $scope.$new();
        try {
            $controller(controllerName, locals);
            if ($scope.routing.newRecord) {
                addThis = "creating";
            } else if ($scope.routing.id) {
                addThis = "editing";
            } else {
                addThis = "listing";
            }
            angular.forEach($scope.scopes[level].contextMenu, function(value) {
                if (value[addThis]) {
                    $scope.items.push(value);
                }
            })
        }
        catch(error) {
            if (/is not a function, got undefined/.test(error.message )) {
                // No such controller - don't care
            } else {
                console.log("Unable to instantiate "+controllerName + " - " + error.message);
            }
        }
    }

    $scope.$on('$locationChangeSuccess', function (event, newUrl, oldUrl) {

        $scope.routing = $locationParse($location.$$path);

        $scope.items = [];

        if ($scope.routing.modelName) {

            angular.forEach($scope.scopes, function(value, key){
                value.$destroy();
            });
            $scope.scopes = [];
            // Now load context menu.  For /person/client/:id/edit we need
            // to load PersonCtrl and PersonClientCtrl
            $scope.contextMenu = $filter('titleCase')($scope.routing.modelName, true);
            loadMenu($scope.contextMenu,0);
            if ($scope.routing.formName) {
                loadMenu($scope.contextMenu + $filter('titleCase')($scope.routing.formName, true),1);
            }
        }
    });

    $scope.doClick = function(index) {
        // Performance optimization: http://jsperf.com/apply-vs-call-vs-invoke
        var args = $scope.items[index].args || [],
            fn = $scope.items[index].fn,
            result;
        switch (args.length) {
            case  0:
                result = fn();
                break;
            case  1:
                result =  fn(args[0]);
                break;
            case  2:
                result =  fn(args[0], args[1]);
                break;
            case  3:
                result =  fn(args[0], args[1], args[2]);
                break;
            case  4:
                result =  fn(args[0], args[1], args[2], args[3]);
                break;
        }
    }
}]);

formsAngular.controller('SearchCtrl', ['$scope', '$http', function ($scope, $http) {

    $scope.results = [];
    $scope.moreCount = 0;

    $scope.$watch('searchTarget', function(newValue) {
        if (newValue && newValue.length > 0) {
            $http.get('api/search?q=' + newValue).success(function (data) {
                $scope.results = data.results;
                $scope.moreCount = data.moreCount;
                $scope.errorClass = $scope.results.length === 0 ? "error" : "";
            }).error(function (data, status) {
                console.log("Error in searchbox.js : " + data + ' (status=' + status + ')');
            });
        } else {
            $scope.errorClass = "";
            $scope.results = [];
        }
    },true);

    $scope.$on("$routeChangeStart", function (event, next) {
        $scope.searchTarget = '';
    });

}]);

angular.module("fng.ui.bootstrap", ["fng.ui.bootstrap.tpls", "fng.ui.bootstrap.dropdownToggle","fng.ui.bootstrap.tabs"]);
angular.module("fng.ui.bootstrap.tpls", ["template/tabs/pane.html","template/tabs/tabs.html"]);
/*
 * dropdownToggle - Provides dropdown menu functionality in place of bootstrap js
 * @restrict class or attribute
 * @example:
 <li class="dropdown">
 <a class="dropdown-toggle">My Dropdown Menu</a>
 <ul class="dropdown-menu">
 <li ng-repeat="choice in dropChoices">
 <a ng-href="{{choice.href}}">{{choice.text}}</a>
 </li>
 </ul>
 </li>
 */

angular.module('fng.ui.bootstrap.dropdownToggle', []).directive('dropdownToggle',
    ['$document', '$location', '$window', function ($document, $location, $window) {
        var openElement = null,
            closeMenu   = angular.noop;
        return {
            restrict: 'CA',
            link: function(scope, element, attrs) {
                scope.$watch('$location.path', function() { closeMenu(); });
                element.parent().bind('click', function() { closeMenu(); });
                element.bind('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var elementWasOpen = (element === openElement);
                    if (!!openElement) {
                        closeMenu(); }
                    if (!elementWasOpen){
                        element.parent().addClass('open');
                        openElement = element;
                        closeMenu = function (event) {
                            if (event) {
                                event.preventDefault();
                                event.stopPropagation();
                            }
                            $document.unbind('click', closeMenu);
                            element.parent().removeClass('open');
                            closeMenu   = angular.noop;
                            openElement = null;
                        };
                        $document.bind('click', closeMenu);
                    }
                });
            }
        };
    }]);
angular.module('fng.ui.bootstrap.tabs', [])
    .controller('TabsController', ['$scope', '$element', function($scope, $element) {
        var panes = $scope.panes = [];

        this.select = $scope.select = function selectPane(pane) {
            angular.forEach(panes, function(pane) {
                pane.selected = false;
            });
            pane.selected = true;
        };

        this.addPane = function addPane(pane) {
            if (!panes.length) {
                $scope.select(pane);
            }
            panes.push(pane);
        };

        this.removePane = function removePane(pane) {
            var index = panes.indexOf(pane);
            panes.splice(index, 1);
            //Select a new pane if removed pane was selected
            if (pane.selected && panes.length > 0) {
                $scope.select(panes[index < panes.length ? index : index-1]);
            }
        };
    }])
    .directive('tabs', function() {
        return {
            restrict: 'EA',
            transclude: true,
            scope: {},
            controller: 'TabsController',
            templateUrl: 'template/tabs/tabs.html',
            replace: true
        };
    })
    .directive('pane', ['$parse', function($parse) {
        return {
            require: '^tabs',
            restrict: 'EA',
            transclude: true,
            scope:{
                heading:'@'
            },
            link: function(scope, element, attrs, tabsCtrl) {
                var getSelected, setSelected;
                scope.selected = false;
                if (attrs.active) {
                    getSelected = $parse(attrs.active);
                    setSelected = getSelected.assign;
                    scope.$watch(
                        function watchSelected() {return getSelected(scope.$parent);},
                        function updateSelected(value) {scope.selected = value;}
                    );
                    scope.selected = getSelected ? getSelected(scope.$parent) : false;
                }
                scope.$watch('selected', function(selected) {
                    if(selected) {
                        tabsCtrl.select(scope);
                    }
                    if(setSelected) {
                        setSelected(scope.$parent, selected);
                    }
                });

                tabsCtrl.addPane(scope);
                scope.$on('$destroy', function() {
                    tabsCtrl.removePane(scope);
                });
            },
            templateUrl: 'template/tabs/pane.html',
            replace: true
        };
    }]);

angular.module("template/tabs/pane.html", []).run(["$templateCache", function($templateCache){
    $templateCache.put("template/tabs/pane.html",
        "<div class=\"tab-pane\" ng-class=\"{active: selected}\" ng-show=\"selected\" ng-transclude></div>" +
            "");
}]);

angular.module("template/tabs/tabs.html", []).run(["$templateCache", function($templateCache){
    $templateCache.put("template/tabs/tabs.html",
        "<div class=\"tabbable\">" +
            "  <ul class=\"nav nav-tabs\">" +
            "    <li ng-repeat=\"pane in panes\" ng-class=\"{active:pane.selected}\">" +
            "      <a ng-click=\"select(pane)\">{{pane.heading}}</a>" +
            "    </li>" +
            "  </ul>" +
            "  <div class=\"tab-content\" ng-transclude></div>" +
            "</div>" +
            "");
}]);

formsAngular
    .directive('formButtons', ['$compile', function ($compile) {
        return {
            restrict: 'A',
            compile: function () {
                return function ($scope, $element) {
                    var template =
                        '<div class="btn-group pull-right">' +
                            '<button id="saveButton" class="btn btn-mini btn-primary form-btn" ng-click="save()" ng-disabled="isSaveDisabled()"><i class="icon-ok"></i> Save</button>' +
                            '<button id="cancelButton" class="btn btn-mini btn-warning form-btn" ng-click="cancel()" ng-disabled="isCancelDisabled()"><i class="icon-remove"></i> Cancel</button>' +
                        '</div>' +
                        '<div class="btn-group pull-right">' +
                            '<button id="newButton" class="btn btn-mini btn-success form-btn" ng-click="new()" ng-disabled="isNewDisabled()"><i class="icon-plus"></i> New</button>' +
                            '<button id="deleteButton" class="btn btn-mini btn-danger form-btn" ng-click="delete()" ng-disabled="isDeleteDisabled()"><i class="icon-minus"></i> Delete</button>' +
                        '</div>';
                    $element.replaceWith($compile(template)($scope));
                }
            }
        }
    }]);

formsAngular
    .directive('formInput', ['$compile', '$rootScope', function ($compile, $rootScope) {
        return {
            restrict: 'E',
            replace: true,
            priority: 1,
            compile: function () {
                return function (scope, element, attrs) {
                    scope.$watch(attrs.formInput, function () {

                        var generateInput = function (fieldInfo, modelString, isRequired, idString) {
                            var focusStr = '', placeHolder = '';
                            if (!modelString) {
                                if (fieldInfo.name.indexOf('.') != -1 && element[0].outerHTML.indexOf('schema="true"') != -1) {
                                    // Schema handling - need to massage the ngModel and the id
                                    var compoundName = fieldInfo.name,
                                        lastPartStart = compoundName.lastIndexOf('.');
                                    modelString = 'record.' + compoundName.slice(0, lastPartStart) + '.' + scope.$parent.$index + '.' + compoundName.slice(lastPartStart + 1);
                                    idString = modelString.replace(/\./g, '-')
                                } else {
                                    modelString = (attrs.model || 'record') + '.' + fieldInfo.name;
                                    if (scope.$index === 0) {
                                        focusStr = "autofocus ";
                                    }
                                }
                            }
                            var value
                                , requiredStr = (isRequired || fieldInfo.required) ? ' required' : ''
                                , readonlyStr = fieldInfo.readonly ? ' readonly' : ''
                                , common;

                            var common = focusStr + 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '" ' : ' ') + (fieldInfo.placeHolder ? ('placeholder="'+fieldInfo.placeHolder+'" ') : "");
                            if (fieldInfo.type === 'select') {
                                common += (fieldInfo.readonly ? 'disabled ' : '');
                                if (fieldInfo.select2) {
                                    common += 'class="fng-select2' + (fieldInfo.size ? ' input-' + fieldInfo.size : '') + '"';
                                    if ( fieldInfo.select2.fngAjax) {
                                        value  = '<div class="input-append">';
                                        value +=   '<input ui-select2="' + fieldInfo.select2.fngAjax +'" ' + common + '>';
                                        value +=   '<button class="btn" type="button" data-select2-open="' + idString + '" ng-click="openSelect2($event)"><i class="icon-search"></i></button>';
                                        value += '</div>';
                                    } else if (fieldInfo.select2) {
                                        value = '<input ui-select2="'+ fieldInfo.select2.s2query +'" ' + (fieldInfo.readonly ? 'disabled ' : '') + common + '>';
                                    }
                                } else {
                                    value = '<select ' + common + (fieldInfo.size ? 'class="input-' + fieldInfo.size + '" ' : '')+ '>';
                                    if (!isRequired) { value += '<option></option>';}
                                    value += '<option ng-repeat="option in ' + fieldInfo.options + '">{{option}}</option>';
                                    value += '</select>';
                                }
                            } else if (fieldInfo.type === 'link') {
                                value = '<a ng-href="/#/' + fieldInfo.ref + '/{{ ' + modelString  + '}}/edit">' + fieldInfo.linkText + '</a>';
                            } else {
                                common += (fieldInfo.size ? 'class="input-' + fieldInfo.size + '" ' : '') + (fieldInfo.add ? fieldInfo.add : '') + 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '"' : '') + requiredStr + readonlyStr + ' ';
                                if (fieldInfo.type == 'textarea') {
                                    value = '<textarea ' + common + (fieldInfo.rows ? 'rows = "' + fieldInfo.rows + '" ' : '') + ' />';
                                } else {
                                    value = '<input '    + common + 'type="' + info.type + '" />';
                                }
                            }
                            if (fieldInfo.helpInline) {
                                value += '<span class="help-inline">' + fieldInfo.helpInline + '</span>';
                            }
                            if (fieldInfo.help) {
                                value += '<span class="help-block">' + fieldInfo.help + '</span>';
                            }
                            return value;
                        };

                        var generateLabel = function (fieldInfo, addButton) {
                            var labelHTML = '';
                            if (fieldInfo.label !== '' || addButton) {
                                labelHTML = '<label class="control-label" for="' + fieldInfo.id + '">' + fieldInfo.label + (addButton || '') + '</label>';
                            }
                            return labelHTML;
                        };

                        var handleField = function (info) {
                            var template = '<div class="control-group" id="cg_' + info.id + '">';
                            if (info.schema) {
                                //schemas (which means they are arrays in Mongoose)

                                var schemaLoop;
                                if (scope.formSchema[scope.$index] && info.id === scope.formSchema[scope.$index].id) {
                                    schemaLoop = 'field in formSchema[' + scope.$index + '].schema'
                                } else {
                                    // we are in a pane
                                    schemaLoop = 'field in panes[' + scope.$parent.$index + '].content[' + scope.$index + '].schema'
                                }

                                template += '<div class="schema-head well">' + info.label + '</div>' +
// for angular 1.0 branch     '<div class="sub-doc well" id="' + info.id + 'List" ng-subdoc-repeat="subDoc in record.' + info.name + '">' +
                                '<div class="sub-doc well" id="' + info.id + 'List" ng-repeat="subDoc in record.' + info.name + ' track by $index">' +
                                    '<div class="row-fluid">' +
                                    '<div class="pull-left">' +
                                    '<form-input ng-repeat="' + schemaLoop + '" info="{{field}}" schema="true"></form-input>' +
                                    '</div>';

                                if (!info.noRemove) {
                                    template += '<div class="pull-left sub-doc-btns">' +
                                        '<button id="remove_' + info.id + '_btn" class="btn btn-mini form-btn" ng-click="remove(this,$index)">' +
                                        '<i class="icon-minus"></i> Remove' +
                                        '</button>' +
                                        '</div> '
                                }

                                template += '</div>' +
                                    '</div>' +
                                    '<div class = "schema-foot well">';
                                if (!info.noAdd) {
                                    template += '<button id="add_' + info.id + '_btn" class="btn btn-mini form-btn" ng-click="add(this)">' +
                                        '<i class="icon-plus"></i> Add' +
                                        '</button>'
                                }
                                template += '</div>';

                            } else {
                                // Handle arrays here
                                if (info.array) {
                                    template += generateLabel(info, ' <i id="add_' + info.id + ' " ng-click="add(this)" class="icon-plus-sign"></i>') +
                                        '<div class="controls" id="' + info.id + 'List" ng-repeat="arrayItem in record.' + info.name + '">' +
                                        generateInput(info, "arrayItem.x", true, null) +
                                        '<i ng-click="remove(this,$index)" class="icon-minus-sign"></i>' +
                                        '</div>';
                                } else {
                                    // Single fields here
                                    template += generateLabel(info) +
                                        '<div class="controls">' +
                                        generateInput(info, null, attrs.required, info.id) +
                                        '</div>';
                                }
                            }
                            template += '</div>';
                            return template;
                        };

                        var info = JSON.parse(attrs.info);
                        if (info.directive) {
                            var newElement = '<' + info.directive;
                            var thisElement = element[0];
                            for (var i = 0; i < thisElement.attributes.length; i++) {
                                var thisAttr = thisElement.attributes[i];
                                switch (thisAttr.nodeName) {
                                    case 'ng-repeat' :
                                        break;
                                    case 'class' :
                                        var classes = thisAttr.nodeValue.replace('ng-scope','');
                                        if (classes.length > 0) {
                                            newElement += ' class="' + classes + '"';
                                        }
                                        break;
                                    case 'info' :
                                        var options = JSON.parse(thisAttr.nodeValue);
                                        delete options.directive;
                                        newElement += ' info="' + JSON.stringify(options).replace(/\"/g,'&quot;') + '"';
                                        break;
                                    default :
                                        newElement += ' ' + thisAttr.nodeName + '="' + thisAttr.nodeValue + '"';
                                }
                            }
                            newElement += '></' + info.directive + '>';
                            element.replaceWith($compile(newElement)(scope));
                        } else {
                            var template = handleField(info);
                            element.replaceWith($compile(template)(scope));
                        }

                        if (scope.updateDataDependentDisplay) {
                            // If this is not a test force the data dependent updates to the DOM
                            scope.updateDataDependentDisplay(scope.record, null, true);
                        }
                        // Todo - find a better way of communicating with controllers
                        $rootScope.$broadcast('formInputDone',info)
                    });
                };
            }
        };
    }]);


// No longer need as ng-repeat improved in angular 1.2
//formsAngular
//// Directive to handle subdocs.  Mostly a copy of ng-repeat, but needed to simplify it a bit to make it work
//    .directive('ngSubdocRepeat', [function () {
//        return {
//            transclude: 'element',
//            priority: 1000,
//            terminal: true,
//            compile: function (element, attr, linker) {
//                return function (scope, iterStartElement, attr) {
//                    var expression = attr.ngSubdocRepeat;
//                    var match = expression.match(/^\s*(.+)\s+in\s+(.*)\s*$/),
//                        lhs, rhs, valueIdent, keyIdent;
//                    if (!match) {
//                        throw Error("Expected ngSubdocRepeat in form of '_item_ in _collection_' but got '" +
//                            expression + "'.");
//                    }
//                    lhs = match[1];
//                    rhs = match[2];
//                    match = lhs.match(/^(?:([\$\w]+)|\(([\$\w]+)\s*,\s*([\$\w]+)\))$/);
//                    if (!match) {
//                        throw Error("'item' in 'item in collection' should be identifier or (key, value) but got '" +
//                            lhs + "'.");
//                    }
//                    valueIdent = match[3] || match[1];
//                    keyIdent = match[2];
//
//                    // Store a list of elements from previous run - an array of objects with following properties:
//                    //   - scope: bound scope
//                    //   - element: previous element.
//                    var lastOrderArr = [];
//
//                    scope.$watch(function ngSubdocRepeatWatch(scope) {
//                        var index, length,
//                            collection = scope.$eval(rhs),
//                            cursor = iterStartElement,     // current position of the node
//                        // Same as lastOrder but it has the current state. It will become the
//                        // lastOrder on the next iteration.
//                            nextOrderArr = [],
//                            arrayLength,
//                            childScope,
//                            key, value, // key/value of iteration
//                            array,
//                            last;       // last object information {scope, element, index}
//                        if (!angular.isArray(collection)) {
//                            // if object, extract keys, sort them and use to determine order of iteration over obj props
//                            array = [];
//                            for (key in collection) {
//                                if (collection.hasOwnProperty(key) && key.charAt(0) != '$') {
//                                    array.push(key);
//                                }
//                            }
//                            array.sort();
//                        } else {
//                            array = collection || [];
//                        }
//
//                        arrayLength = array.length;
//
//                        // we are not using forEach for perf reasons (trying to avoid #call)
//                        for (index = 0, length = array.length; index < length; index++) {
//                            key = (collection === array) ? index : array[index];
//                            value = collection[key];
//
//                            last = lastOrderArr.shift();
//
//                            if (last) {
//                                // if we have already seen this object, then we need to reuse the
//                                // associated scope/element
//                                childScope = last.scope;
//                                nextOrderArr.push(last);
//                                cursor = last.element;
//                            } else {
//                                // new item which we don't know about
//                                childScope = scope.$new();
//                            }
//
//                            childScope[valueIdent] = value;
//                            if (keyIdent) childScope[keyIdent] = key;
//                            childScope.$index = index;
//                            childScope.$first = (index === 0);
//                            childScope.$last = (index === (arrayLength - 1));
//                            childScope.$middle = !(childScope.$first || childScope.$last);
//
//                            if (!last) {
//                                linker(childScope, function (clone) {
//                                    cursor.after(clone);
//                                    last = {
//                                        scope: childScope,
//                                        element: (cursor = clone),
//                                        index: index
//                                    };
//                                    nextOrderArr.push(last);
//                                });
//                            }
//                        }
//
//                        //shrink children
//                        for (var j = 0; j < lastOrderArr.length ; j++) {
//                            lastOrderArr[j].element.remove();
//                            lastOrderArr[j].scope.$destroy();
//                        }
//
//                        lastOrderArr = nextOrderArr;
//                    });
//                };
//            }
//        }
//    }]);
//

formsAngular.filter('titleCase',[function() {
    return function(str, stripSpaces) {
        var value = str.replace(/(_|\.)/g, ' ').replace(/[A-Z]/g, ' $&').replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        if (stripSpaces) {
            value = value.replace(/\s/g,'');
        }
        return value;
    }
}]);
'use strict';

formsAngular.factory('$data', [function() {

    var sharedData = {
        record: {},
        disableFunctions: {},
        dataEventFunctions: {}
    };
    return sharedData;

}]);

'use strict';

formsAngular.factory('$locationParse', [function() {

        var lastRoute = null,
            lastObject = {};

        return function(location) {

            if (location !== lastRoute) {
                lastRoute = location;
                var locationSplit = location.split('/');
                var locationParts = locationSplit.length;
                if (locationParts == 2 && locationSplit[1] == 'index') {
                    lastObject = {index: true};
                } else {
                    lastObject = {newRecord: false};
                    lastObject.modelName = locationSplit[1];
                    var lastPart = locationSplit[locationParts - 1];
                    if (lastPart === "new") {
                        lastObject.newRecord = true;
                        locationParts--;
                    } else if (lastPart === "edit") {
                        locationParts = locationParts - 2
                        lastObject.id = locationSplit[locationParts];
                    }
                    if (locationParts > 2) {
                       lastObject.formName = locationSplit[2];
                    }
                }
            }
            return lastObject;
        }
    }]);

