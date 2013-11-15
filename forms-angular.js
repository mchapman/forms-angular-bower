/*! forms-angular 2013-11-15 */
'use strict';

var formsAngular = angular.module('formsAngular', [
	  'ngRoute'
    , 'ngSanitize'
    , 'ui.select2'
    , 'ui.date'
    , 'fng.ui.bootstrap'
    , 'ui.bootstrap'
    , 'ngGrid'
    , 'infinite-scroll'
    , 'monospaced.elastic'
]);

// Ideally would want a config call in here which adds the routes, below, but couldn't get it to work
//    when('/analyse/:model/:reportSchemaName', {templateUrl: 'partials/base-analysis.html'}).
//    when('/analyse/:model', {templateUrl: 'partials/base-analysis.html'}).
//    when('/:model/:id/edit', {templateUrl: 'partials/base-edit.html'}).
//    when('/:model/new', {templateUrl: 'partials/base-edit.html'}).
//    when('/:model', {templateUrl: 'partials/base-list.html'}).
//    when('/:model/:form/:id/edit', {templateUrl: 'partials/base-edit.html'}).  // non default form (different fields etc)
//    when('/:model/:form/new', {templateUrl: 'partials/base-edit.html'}).       // non default form (different fields etc)
//    when('/:model/:form', {templateUrl: 'partials/base-list.html'}).           // list page with links to non default form


formsAngular.controller('AnalysisCtrl', ['$locationParse', '$filter', '$scope', '$http', '$location', '$routeParams', function ($locationParse, $filter, $scope, $http, $location, $routeParams) {
    var firstTime = true,
        pdfPlugIn = new ngGridPdfExportPlugin({inhibitButton:true}),
        csvPlugIn = new ngGridCsvExportPlugin({inhibitButton:true});

    angular.extend($scope, $routeParams);
    $scope.reportSchema = {};
    $scope.gridOptions = {
        columnDefs : 'reportSchema.columnDefs',
        data: 'report',
        showColumnMenu: true,
        showFilter: true,
        showFooter: true,    // always set this to true so it works out the style
        reallyShowFooter: true,   // this determines whether it is actually displayed or not
        showTotals: true,
        enableColumnResize: true,
//        enableColumnReordering: true,
//        jqueryUIDraggable: true,
        footerRowHeight: 65,
        multiSelect: false,
        plugins: [pdfPlugIn, csvPlugIn],
        afterSelectionChange: function (rowItem) {
            var url = $scope.reportSchema.drilldown;
            if (url) {
                url = url.replace(/!.+?!/g,function(match){
                    var param = match.slice(1,-1),
                        isParamTest = /\((.+)\)/.exec(param);
                    return isParamTest ? $scope.reportSchema.params[isParamTest[1]].value : rowItem.entity[param];
                });
                window.location = url;
            }
        },
        footerTemplate:
'<div ng-show="gridOptions.reallyShowFooter" class="ngFooterPanel" ng-class="{\'ui-widget-content\': jqueryUITheme, \'ui-corner-bottom\': jqueryUITheme}" ng-style="footerStyle()">'+
 '<div ng-show="gridOptions.showTotals" ng-style="{height: rowHeight+3}">'+
  '<div ng-style="{ \'cursor\': row.cursor }" ng-repeat="col in renderedColumns" ng-class="col.colIndex()" class="ngCell ngTotalCell {{col.cellClass}}">' +
   '<div class="ngVerticalBar" ng-style="{height: rowHeight}" ng-class="{ ngVerticalBarVisible: !$last }">&nbsp;</div>' +
   '<div ng-total-cell></div>' +
 ' </div>' +
 '</div>' +
 '<div class="ngTotalSelectContainer" >'+
  '<div class="ngFooterTotalItems" ng-class="{\'ngNoMultiSelect\': !multiSelect}" >'+
   '<span class="ngLabel">{{i18n.ngTotalItemsLabel}} {{maxRows()}}</span><span ng-show="filterText.length > 0" class="ngLabel">({{i18n.ngShowingItemsLabel}} {{totalFilteredItemsLength()}})</span>'+
  '</div>'+
  '<div class="ngFooterSelectedItems" ng-show="multiSelect">'+
 '  <span class="ngLabel">{{i18n.ngSelectedItemsLabel}} {{selectedItems.length}}</span>'+
  '</div>'+
 '</div>'+
 '<div class="ngPagerContainer" style="float: right; margin-top: 10px;" ng-show="enablePaging" ng-class="{\'ngNoMultiSelect\': !multiSelect}">'+
  '<div style="float:left; margin-right: 10px;" class="ngRowCountPicker">'+
   '<span style="float: left; margin-top: 3px;" class="ngLabel">{{i18n.ngPageSizeLabel}}</span>'+
   '<select style="float: left;height: 27px; width: 100px" ng-model="pagingOptions.pageSize" >'+
    '<option ng-repeat="size in pagingOptions.pageSizes">{{size}}</option>'+
   '</select>'+
  '</div>'+
  '<div style="float:left; margin-right: 10px; line-height:25px;" class="ngPagerControl" style="float: left; min-width: 135px;">'+
   '<button class="ngPagerButton" ng-click="pageToFirst()" ng-disabled="cantPageBackward()" title="{{i18n.ngPagerFirstTitle}}"><div class="ngPagerFirstTriangle"><div class="ngPagerFirstBar"></div></div></button>'+
   '<button class="ngPagerButton" ng-click="pageBackward()" ng-disabled="cantPageBackward()" title="{{i18n.ngPagerPrevTitle}}"><div class="ngPagerFirstTriangle ngPagerPrevTriangle"></div></button>'+
   '<input class="ngPagerCurrent" min="1" max="{{maxPages()}}" type="number" style="width:50px; height: 24px; margin-top: 1px; padding: 0 4px;" ng-model="pagingOptions.currentPage"/>'+
   '<button class="ngPagerButton" ng-click="pageForward()" ng-disabled="cantPageForward()" title="{{i18n.ngPagerNextTitle}}"><div class="ngPagerLastTriangle ngPagerNextTriangle"></div></button>'+
   '<button class="ngPagerButton" ng-click="pageToLast()" ng-disabled="cantPageToLast()" title="{{i18n.ngPagerLastTitle}}"><div class="ngPagerLastTriangle"><div class="ngPagerLastBar"></div></div></button>'+
  '</div>'+
 '</div>'+
'</div>'
    };
    $scope.report = [];

    if (!$scope.reportSchemaName && $routeParams.r) {
        switch ($routeParams.r.slice(0, 1)) {
            case '[' :
                $scope.reportSchema.pipeline = JSON.parse($routeParams.r);
                break;
            case '{' :
                angular.extend($scope.reportSchema, JSON.parse($routeParams.r));
                break;
            default :
                throw new Error("No report instructions specified");
        }
    }

    $scope.getTotalVal = function(field, filter) {
        var result = '',
            instructions = _.find($scope.reportSchema.columnDefs,function(col) {
                return col.field === field;
            });

        if (instructions) {
            switch (instructions.totalsRow) {
                case undefined :
                    break;
                case '$SUM' :
                    var sum = 0;
                    for (var j = 0; j < $scope.report.length ;j++) {
                        sum += $scope.report[j][field]
                    }
                    result = sum;
                    if (filter) {
                        result = $filter(filter)(result);
                    }
                    break;
                default :
                    result = instructions.totalsRow;
                    break;
            }
        }

        return result;
    };

    $scope.$on('exportToPDF', function() {
        pdfPlugIn.createPDF();
    });

    $scope.$on('exportToCSV', function() {
        csvPlugIn.createCSV();
    });

    $scope.refreshQuery = function() {

        var apiCall = '/api/report/' + $scope.model
            ,connector = '?';
        if ($scope.reportSchemaName) {
            apiCall += '/'+$scope.reportSchemaName
        }

        if ($scope.paramSchema) {
            // we are using the params form
            for (var paramVal in $scope.record) {
                if ($scope.record.hasOwnProperty(paramVal)) {
                    var instructions = $scope.reportSchema.params[paramVal];
                    if ($scope.record[paramVal] && $scope.record[paramVal] !== "") {
                        $scope.param = $scope.record[paramVal];
                        if (instructions.conversionExpression) {
                            $scope.param = $scope.$eval(instructions.conversionExpression);
                        }
                        apiCall += connector + paramVal + '=' + $scope.param;
                        connector = '&';
                    } else if (instructions.required) {
                        // Don't do a round trip if a required field is empty - it will show up red
                        return;
                    }
                }
            }
        } else {
            // take params of the URL
            var query = $location.$$url.match(/\?.*/);
            if (query) {
                apiCall += connector + query[0].slice(1)
            }
        }
        $http.get(apiCall).success(function (data) {
            if (data.success) {
                $scope.report = data.report;
                $scope.reportSchema = data.schema;
                $scope.reportSchema.title = $scope.reportSchema.title || $scope.model;

                if (firstTime) {
                    firstTime = false;

                    $scope.$watch('reportSchema.columnDefs', function (newValue) {
                        var columnTotals = false;
                        if (newValue) {
                            for (var i=0; i < newValue.length; i++) {
                                if (newValue[i].totalsRow) {
                                    columnTotals = true;
                                }
                                if (newValue[i].align) {
                                    var alignClass='fng-' + newValue[i].align;
                                    newValue[i].cellClass = newValue[i].cellClass || '';
                                    if (newValue[i].cellClass.indexOf(alignClass) === -1) {
                                        newValue[i].cellClass = newValue[i].cellClass + ' ' + alignClass;
                                    }
                                }
                            }
                        }
                        $scope.gridOptions.showTotals = columnTotals;
                        $scope.gridOptions.reallyShowFooter = columnTotals;
                        $scope.gridOptions.footerRowHeight = 55 + (columnTotals ? 10 : 0);
                    },true);

                    if (!$scope.paramSchema && data.schema.params) {
                        $scope.paramSchema = [];
                        // set up parameters
                        $scope.record = {};
                        for (var param in data.schema.params) {
                            if (data.schema.params.hasOwnProperty(param)) {
                                var thisPart = data.schema.params[param];
                                // if noInput then this value will be inferred from another parameter
                                if (!thisPart.noInput) {
                                    var newLen = $scope.paramSchema.push({
                                        name: param,
                                        id: 'fp_'+param,
                                        label: thisPart.label || $filter('titleCase')(param),
                                        type : thisPart.type || 'text',
                                        required: true,
                                        add: thisPart.add || undefined,
                                        size: thisPart.size || 'small'
                                    });
                                    if (thisPart.type === 'select') {
                                        // TODO: Remove when select and select2 is modified during the restructure
                                        $scope[param + '_Opts'] = thisPart.enum;
                                        $scope.paramSchema[newLen-1].options = param + '_Opts';
                                    }
                                }
                                $scope.record[param] = thisPart.value;
                            }
                        }
                        $scope.$watch('record', function (newValue, oldValue) {
                            if (oldValue !== newValue) {
                                $scope.refreshQuery();
                            }
                        },true);

                    }
                }
            } else {
                console.log(JSON.stringify(data));
                $scope.reportSchema.title = "Error - see console log";
            }
        }).error(function (err) {
                console.log(JSON.stringify(err));
                $location.path("/404");
             });
    };

    $scope.refreshQuery();

}]);



formsAngular.controller('BaseCtrl', ['$scope', '$routeParams', '$location', '$http', '$filter', '$data', '$locationParse', '$dialog', function ($scope, $routeParams, $location, $http, $filter, $data, $locationParse, $dialog) {
    var master = {};
    var fngInvalidRequired = 'fng-invalid-required';
    var sharedStuff = $data;
    var allowLocationChange = true;   // Set when the data arrives..

    $scope.record = sharedStuff.record;
    $scope.phase = 'init';
    $scope.disableFunctions = sharedStuff.disableFunctions;
    $scope.dataEventFunctions = sharedStuff.dataEventFunctions;
    $scope.formSchema = [];
    $scope.panes = [];
    $scope.listSchema = [];
    $scope.recordList = [];
    $scope.dataDependencies = {};
    $scope.select2List = [];
    $scope.page_size = 20;
    $scope.pages_loaded = 0;

    angular.extend($scope, $locationParse($location.$$path));

    $scope.formPlusSlash = $scope.formName ? $scope.formName + '/' : '';
    $scope.modelNameDisplay = sharedStuff.modelNameDisplay || $filter('titleCase')($scope.modelName);
    $scope.getId = function(obj) {return obj._id;}

    $scope.walkTree = function (object, fieldname, element) {
        // Walk through subdocs to find the required key
        // for instance walkTree(master,'address.street.number',element)
        // called by getData and setData
        var parts = fieldname.split('.')
            , higherLevels = parts.length - 1
            , workingRec = object
            , re
            , id;

        if (element) {
            id = element.context.id;
        }
        for (var i = 0; i < higherLevels; i++) {
            workingRec = workingRec[parts[i]];
            if (angular.isArray(workingRec)) {
                // If we come across an array we need to find the correct position
                // or raise an exception
                re = new RegExp(parts[i] + "-([0-9])-" + parts[i + 1]);
                workingRec = workingRec[parseInt(id.match(re)[1])]
            }
        }
        return {lastObject: workingRec, key: parts[higherLevels]};
    };

    $scope.getData = function (object, fieldname, element) {
        var leafData = $scope.walkTree(object, fieldname, element);
        return leafData.lastObject[leafData.key]
    };

    $scope.setData = function (object, fieldname, element, value) {
        var leafData = $scope.walkTree(object, fieldname, element);
        leafData.lastObject[leafData.key] = value;
    };

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

                    $scope.$watch('record.' + formInstructions.name, function (newValue) {
                        updateInvalidClasses(newValue, formInstructions.id, formInstructions.select2);
                    }, true);
                    setTimeout(function () {
                        updateInvalidClasses($scope.record[formInstructions.name], formInstructions.id, formInstructions.select2);
                    }, 0)
                }
                if (formInstructions.select2) {
                    $scope['select2' + formInstructions.name] = {
                        allowClear: !mongooseOptions.required,
                        initSelection: function (element, callback) {
                            var myVal = element.val();
                            var display = {id: myVal, text: myVal};
                            callback(display);
                        },
                        query: function (query) {
                            var data = {results: []},
                                searchString = query.term.toUpperCase();
                            for (var i = 0; i < mongooseOptions.enum.length; i++) {
                                if (mongooseOptions.enum[i].toUpperCase().indexOf(searchString) !== -1) {
                                    data.results.push({id: i, text: mongooseOptions.enum[i]})
                                }
                            }
                            query.callback(data);
                        }
                    };
                    _.extend($scope['select2' + formInstructions.name], formInstructions.select2);
                    formInstructions.select2.s2query = 'select2' + formInstructions.name;
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
                formInstructions.form = formInstructions.link.form;
                delete formInstructions.link;
            } else {
                formInstructions.type = 'select';
                if (formInstructions.select2) {
                    $scope.select2List.push(formInstructions.name);
                    if (formInstructions.select2.fngAjax) {
                        // create the instructions for select2
                        select2ajaxName = 'ajax' + formInstructions.name.replace(/\./g, '');
                        $scope[select2ajaxName] = {
                            allowClear: !mongooseOptions.required,
                            minimumInputLength: 2,
                            initSelection: function (element, callback) {
                                $http.get('api/' + mongooseOptions.ref + '/' + element.val() + '/list').success(function (data) {
                                    if (data.success === false) {
                                        $location.path("/404");
                                    }
                                    var display = {id: element.val(), text: data.list};
                                    $scope.setData(master, formInstructions.name, element, display);
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
                        $scope['select2' + formInstructions.name] = {
                            allowClear: !mongooseOptions.required,
                            initSelection: function (element, callback) {
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
                                for (var i = 0; i < $scope[formInstructions.options].length; i++) {
                                    if ($scope[formInstructions.options][i].toUpperCase().indexOf(searchString) !== -1) {
                                        data.results.push({id: $scope[formInstructions.ids][i], text: $scope[formInstructions.options][i]})
                                    }
                                }
                                query.callback(data);
                            }
                        };
                        _.extend($scope['select2' + formInstructions.name], formInstructions.select2);
                        formInstructions.select2.s2query = 'select2' + formInstructions.name;
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
        formData.id = formData.id || 'f_' + prefix + field.replace(/\./g, '_');
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
        if (record && $scope.select2List.indexOf(nests[i - 1]) !== -1) {
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
                pane = $scope.panes[$scope.panes.push({title: paneTitle, containerType: 'pane', content: [], active: active}) - 1]
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

    $scope.readRecord = function () {
        $http.get('api/' + $scope.modelName + '/' + $scope.id).success(function (data) {
            if (data.success === false) {
                $location.path("/404");
            }
            allowLocationChange = false;
            if (typeof $scope.dataEventFunctions.onAfterRead === "function") {
                $scope.dataEventFunctions.onAfterRead(data);
            }
            master = convertToAngularModel($scope.formSchema, data, 0);
            $scope.phase = 'ready';
            $scope.cancel();
            }).error(function () {
                $location.path("/404");
            });
    };

    function generateListQuery() {
        var queryString = '?l=' + $scope.page_size
            , addParameter = function (param, value) {
                if (value && value !== '') {
                    queryString += '&' + param + '=' + value;
                }
            };

        addParameter('f', $routeParams.f);
        addParameter('a', $routeParams.a);
        addParameter('o', $routeParams.o);
        addParameter('s', $scope.pages_loaded * $scope.page_size);
        $scope.pages_loaded++;
        return queryString;
    }

    $scope.scrollTheList = function () {
        $http.get('api/' + $scope.modelName + generateListQuery()).success(function (data) {
            $scope.recordList = $scope.recordList.concat(data);
        }).error(function () {
                $location.path("/404");
            });
    };

    $http.get('api/schema/' + $scope.modelName + ($scope.formName ? '/' + $scope.formName : ''), {cache: true}).success(function (data) {

        handleSchema('Main ' + $scope.modelName, data, $scope.formSchema, $scope.listSchema, '', true);

        if (!$scope.id && !$scope.newRecord) { //this is a list. listing out contents of a collection
            allowLocationChange = true;
// ngInfiniteList does all this
//            $scope.pages_loaded = 0;
//            $http.get('api/' + $scope.modelName + generateListQuery()).success(function (data) {
//                $scope.recordList = data;
//            }).error(function () {
//                    $location.path("/404");
//                });
        } else {
            $scope.$watch('record', function (newValue, oldValue) {
                $scope.updateDataDependentDisplay(newValue, oldValue, false)
            }, true);

            if ($scope.id) {
                // Going to read a record
                if (typeof $scope.dataEventFunctions.onBeforeRead === "function") {
                    $scope.dataEventFunctions.onBeforeRead($scope.id, function (err) {
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
                // New record
                master = {};
                $scope.phase = 'ready';
                $scope.cancel();
            }
        }
    }).error(function () {
            $location.path("/404");
        });

    $scope.cancel = function () {

        for (var prop in $scope.record) {
            if ($scope.record.hasOwnProperty(prop)) {
                delete $scope.record[prop];
            }
        }

        $.extend(true, $scope.record, master);
        $scope.dismissError();

//  TODO: Sort all this pristine stuff now we are on 1.2
//        if ($scope.myForm) {
//            console.log('Calling set pristine')
//            $scope.myForm.$setPristine();
//        } else {
//            console.log("No form");
//        }
    };

    var handleError = function (data, status) {
        if ([200, 400].indexOf(status) !== -1) {
            var errorMessage = '';
            for (var errorField in data.errors) {
                if (data.errors.hasOwnProperty(errorField)) {
                    errorMessage += '<li><b>' + $filter('titleCase')(errorField) + ': </b> ';
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

    $scope.createNew = function (dataToSave, options) {
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
                showError(data);
            }
        }).error(handleError);
    };

    $scope.updateDocument = function (dataToSave, options) {
        $http.post('api/' + $scope.modelName + '/' + $scope.id, dataToSave).success(function (data) {
            if (data.success !== false) {
                if (typeof $scope.dataEventFunctions.onAfterUpdate === "function") {
                    $scope.dataEventFunctions.onAfterUpdate(data, master)
                }
                if (options.redirect) {
                    if (options.allowChange) {
                        allowLocationChange = true;
                    }
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

    };

    $scope.save = function (options) {
        options = options || {};

        //Convert the lookup values into ids
        var dataToSave = convertToMongoModel($scope.formSchema, angular.copy($scope.record), 0);
        if ($scope.id) {
            if (typeof $scope.dataEventFunctions.onBeforeUpdate === "function") {
                $scope.dataEventFunctions.onBeforeUpdate(dataToSave, master, function (err) {
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
                $scope.dataEventFunctions.onBeforeCreate(dataToSave, function (err) {
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

    $scope.deleteRecord = function (model, id) {
        $http.delete('api/' + model + '/' + id).success(function () {
            if (typeof $scope.dataEventFunctions.onAfterDelete === "function") {
                $scope.dataEventFunctions.onAfterDelete(master);
            }
            $location.path('/' + $scope.modelName);
        });
    };

    $scope.$on('$locationChangeStart', function (event, next) {
        if (!allowLocationChange && !$scope.isCancelDisabled()) {
            $dialog.messageBox('Record modified', 'Would you like to save your changes?', [
                    { label: 'Yes', result: 'yes', cssClass: 'dlg-yes'},
                    {label: 'No', result: 'no', cssClass: 'dlg-no'},
                    { label: 'Cancel', result: 'cancel', cssClass: 'dlg-cancel'}
                ])
                .open()
                .then(function (result) {
                    switch (result) {
                        case 'no' :
                            allowLocationChange = true;
                            window.location = next;
//                            $location.url = next;
                            break;
                        case 'yes' :
                            $scope.save({redirect: next, allowChange: true});    // save changes
                        // break;   fall through to get the preventDefault
                        case 'cancel' :
                            break;
                    }
                });
            event.preventDefault();
        }
    });

    $scope.delete = function () {

        var boxResult;

        if ($scope.record._id) {

            var msgBox = $dialog.messageBox('Delete Item', 'Are you sure you want to delete this record?', [
                {
                    label: 'Yes',
                    result: 'yes'
                },
                {
                    label: 'No',
                    result: 'no'
                }
            ]);

            msgBox.open().then(function (result) {

                if (result === 'yes') {

                    if (typeof $scope.dataEventFunctions.onBeforeDelete === "function") {
                        $scope.dataEventFunctions.onBeforeDelete(master, function (err) {

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
                }
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
            return angular.equals(master, $scope.record);
        }
    };

    $scope.isSaveDisabled = function () {
        if (typeof $scope.disableFunctions.isSaveDisabled === "function") {
            return $scope.disableFunctions.isSaveDisabled($scope.record, master, $scope.myForm);
        } else {
            return ($scope.myForm && $scope.myForm.$invalid) || angular.equals(master, $scope.record);
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

    $scope.add = function (fieldName) {
        var arrayField;
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

    $scope.remove = function (fieldName, value) {
        // Remove an element from an array
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
            portion[fieldDetails[0]] = fn((typeof theValue === 'Object') ? (theValue.x || theValue.id ) : theValue)
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


    var simpleArrayNeedsX = function (aSchema) {
        var result = false;
        if (aSchema.type === 'text') {
            result = true;
        } else if ((aSchema.type === 'select') && !aSchema.ids) {
            result = true;
        }
        return result;
    };

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
                var thisField = $scope.getListData(anObject, fieldname);
                if (schema[i].array && simpleArrayNeedsX(schema[i]) && thisField) {
                    for (var k = 0; k < thisField.length; k++) {
                        thisField[k] = {x: thisField[k]}
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
            var thisField = $scope.getListData(anObject, fieldname);

            if (schema[i].schema) {
                if (thisField) {
                    for (var j = 0; j < thisField.length; j++) {
                        thisField[j] = convertToMongoModel(schema[i].schema, thisField[j], prefixLength + 1 + fieldname.length);
                    }
                }
            } else {

                // Convert {array:[{x:'item 1'}]} to {array:['item 1']}
                if (schema[i].array && simpleArrayNeedsX(schema[i]) && thisField) {
                    for (var k = 0; k < thisField.length; k++) {
                        thisField[k] = thisField[k].x
                    }
                }

                // Convert {lookup:'List description for 012abcde'} to {lookup:'012abcde'}
                var idList = $scope[suffixCleanId(schema[i], '_ids')];
                if (idList && idList.length > 0) {
                    updateObject(fieldname, anObject, function (value) {
                        return( convertToForeignKeys(schema[i], value, $scope[suffixCleanId(schema[i], 'Options')], idList) );
                    });
                } else if (schema[i].select2) {
                    var lookup = $scope.getData(anObject, fieldname, null);
                    if (schema[i].select2.fngAjax) {
                        if (lookup) {
                            $scope.setData(anObject, fieldname, null, lookup.id);
                        }
                    } else {
                        if (lookup) {
                            $scope.setData(anObject, fieldname, null, lookup.text);
                        } else {
                            $scope.setData(anObject, fieldname, null, undefined);
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
        var textToConvert = _.isObject(value) ? (value.x || value.text) : value;
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
        $http.get('api/schema/' + lookupCollection, {cache: true}).success(function (data) {
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
            (schemaElement.select2 && $scope.record[schemaElement.name] && angular.equals(master[schemaElement.name], $scope.record[schemaElement.name].text))) {
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
    $scope.openSelect2 = function (ev) {
        $('#' + $(ev.currentTarget).data('select2-open')).select2('open')
    };

}])
;


formsAngular.controller('ModelCtrl', [ '$scope', '$http', '$location', function ($scope, $http, $location) {

    $scope.models = [];
    $http.get('api/models').success(function (data) {
        $scope.models = data;
    }).error(function () {
            $location.path("/404");
    });

}]);

'use strict';

formsAngular.controller('NavCtrl', ['$scope', '$data', '$location', '$filter', '$locationParse', '$controller', function ($scope, $data, $location, $filter, $locationParse, $controller) {

    $scope.items = [];

    function loadControllerAndMenu(controllerName, level) {
        var locals = {}, addThis;

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
            if (angular.isObject(locals.$scope.contextMenu)) {
                angular.forEach(locals.$scope.contextMenu, function (value) {
                    if (value[addThis]) {
                        $scope.items.push(value);
                    }
                })
            }
        }
        catch (error) {
            if (/is not a function, got undefined/.test(error.message)) {
                // No such controller - don't care
            } else {
                console.log("Unable to instantiate " + controllerName + " - " + error.message);
            }
        }
    }

    $scope.$on('$locationChangeSuccess', function (event, newUrl, oldUrl) {

        $scope.routing = $locationParse($location.$$path);

        $scope.items = [];

        if ($scope.routing.analyse) {
            $scope.contextMenu = 'Report';
            $scope.items = [
                {
                    broadcast: 'exportToPDF',
                    text: "PDF"
                },
                {
                    broadcast: 'exportToCSV',
                    text: "CSV"
                }
            ]
        } else if ($scope.routing.modelName) {

            angular.forEach($scope.scopes, function (value, key) {
                value.$destroy();
            });
            $scope.scopes = [];
            $data.record = {};
            $data.disableFunctions = {};
            $data.dataEventFunctions = {};
            delete $data.dropDownDisplay;
            delete $data.modelNameDisplay;
            // Now load context menu.  For /person/client/:id/edit we need
            // to load PersonCtrl and PersonClientCtrl
            var modelName = $filter('titleCase')($scope.routing.modelName, true);
            loadControllerAndMenu(modelName, 0);
            if ($scope.routing.formName) {
                loadControllerAndMenu(modelName + $filter('titleCase')($scope.routing.formName, true), 1);
            }
            $scope.contextMenu = $data.dropDownDisplay || $data.modelNameDisplay || $filter('titleCase')($scope.routing.modelName, false);
        }
    });

    $scope.doClick = function (index) {
        if ($scope.items[index].broadcast) {
            $scope.$broadcast($scope.items[index].broadcast)
        } else {
            // Performance optimization: http://jsperf.com/apply-vs-call-vs-invoke
            var args = $scope.items[index].args || [],
                fn = $scope.items[index].fn;
            switch (args.length) {
                case  0:
                    fn();
                    break;
                case  1:
                    fn(args[0]);
                    break;
                case  2:
                    fn(args[0], args[1]);
                    break;
                case  3:
                    fn(args[0], args[1], args[2]);
                    break;
                case  4:
                    fn(args[0], args[1], args[2], args[3]);
                    break;
            }
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
    .directive('formInput', ['$compile', '$rootScope','utils', function ($compile, $rootScope, utils) {
        return {
            restrict: 'E',
            compile: function () {
                return function (scope, element, attrs) {

//                    generate markup for bootstrap forms
//
//                    Horizontal (default)
//                    <div class="control-group">
//                        <label class="control-label" for="inputEmail">Email</label>
//                        <div class="controls">
//                            <input type="text" id="inputEmail" placeholder="Email">
//                        </div>
//                    </div>
//
//                    Vertical
//                    <label>Label name</label>
//                    <input type="text" placeholder="Type something…">
//                    <span class="help-block">Example block-level help text here.</span>
//
//                    Inline
//                    <input type="text" class="input-small" placeholder="Email">

                    var elementHtml = ''
                        , subkeys = []
                        , tabsSetup = false;

                    scope.toggleFolder = function(groupId) {
                        scope['showHide'+groupId] = !scope['showHide' + groupId];
                        $('i.' + groupId).toggleClass('icon-folder-open icon-folder-close');
                    };

                    var isHorizontalStyle = function(formStyle) {
                        return (!formStyle || formStyle === "undefined" || formStyle === 'horizontal' || formStyle === 'horizontalCompact');
                    };

                    var generateInput = function (fieldInfo, modelString, isRequired, idString) {
                        if (!modelString) {
                            // We are dealing with an array of sub schemas
                            if (attrs.subschema && fieldInfo.name.indexOf('.') != -1) {
                                // Schema handling - need to massage the ngModel and the id
                                var compoundName = fieldInfo.name,
                                    lastPartStart = compoundName.lastIndexOf('.');

                                if (attrs.subkey) {
                                    modelString = 'record.' + compoundName.slice(0, lastPartStart) + '[' + '$_arrayOffset_' + compoundName.slice(0, lastPartStart).replace(/\./g,'_') + '_' + attrs.subkeyno + '].' + compoundName.slice(lastPartStart + 1);
                                    idString = compoundName + '_subkey';
                                } else {
                                    modelString = 'record.' + compoundName.slice(0, lastPartStart) + '.' + scope.$index + '.' + compoundName.slice(lastPartStart + 1);
                                    idString = modelString.slice(7).replace(/\./g, '-')
                                }
                            } else {
                                modelString = (attrs.model || 'record') + '.' + fieldInfo.name;
                            }
                        }
                        var value
                            , requiredStr = (isRequired || fieldInfo.required) ? ' required' : ''
                            , readonlyStr = fieldInfo.readonly ? ' readonly' : ''
                            , placeHolder = fieldInfo.placeHolder;

                        if (attrs.formstyle === 'inline') placeHolder = placeHolder || fieldInfo.label;
                        var common = 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '" ' : ' ') + (placeHolder ? ('placeholder="' + placeHolder + '" ') : "");
                        common += addAll("Field");
                        if (fieldInfo.type === 'select') {
                            common += (fieldInfo.readonly ? 'disabled ' : '');
                            if (fieldInfo.select2) {
                                common += 'class="fng-select2' + (fieldInfo.size ? ' input-' + fieldInfo.size : '') + '"';
                                if (fieldInfo.select2.fngAjax) {
                                    value = '<div class="input-append">';
                                    value += '<input ui-select2="' + fieldInfo.select2.fngAjax + '" ' + common + '>';
                                    value += '<button class="btn" type="button" data-select2-open="' + idString + '" ng-click="openSelect2($event)"><i class="icon-search"></i></button>';
                                    value += '</div>';
                                } else if (fieldInfo.select2) {
                                    value = '<input ui-select2="' + fieldInfo.select2.s2query + '" ' + (fieldInfo.readonly ? 'disabled ' : '') + common + '>';
                                }
                            } else {
                                value = '<select ' + common + (fieldInfo.size ? 'class="input-' + fieldInfo.size + '" ' : '') + '>';
                                if (!isRequired) {
                                    value += '<option></option>';
                                }
                                value += '<option ng-repeat="option in ' + fieldInfo.options + '">{{option}}</option>';
                                value += '</select>';
                            }
                        } else if (fieldInfo.type === 'link') {
                            value = '<a ng-href="/#/' + fieldInfo.ref + (fieldInfo.form ? '/'+fieldInfo.form : '') + '/{{ ' + modelString + '}}/edit">' + fieldInfo.linkText + '</a>';
                        } else {
                            common += (fieldInfo.size ? 'class="input-' + fieldInfo.size + '" ' : '') + (fieldInfo.add ? fieldInfo.add : '') + 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '"' : '') + requiredStr + readonlyStr + ' ';
                            if (fieldInfo.type == 'textarea') {
                                if (fieldInfo.rows) {
                                    if (fieldInfo.rows == 'auto') {
                                        common += 'msd-elastic="\n" class="ng-animate" ';
                                    } else {
                                        common += 'rows = "' + fieldInfo.rows + '" ';
                                    }
                                }
                                value = '<textarea ' + common + ' />';
                            } else {
                                value = '<input ' + common + 'type="' + fieldInfo.type + '"';
                                if (attrs.formstyle === 'inline') {
                                    if (!fieldInfo.size) {
                                        value += ' class="input-small"';
                                    }
                                }
                                value += ' />';
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

                    var convertFormStyleToClass = function(aFormStyle) {
                        switch (aFormStyle) {
                            case 'horizontal' :
                                return 'form-horizontal';
                                break;
                            case 'vertical' :
                                return '';
                                break;
                            case 'inline' :
                                return 'form-inline';
                                break;
                            case 'horizontalCompact' :
                                return 'form-horizontal compact';
                                break;
                            default:
                                return 'form-horizontal compact';
                                break;
                        }
                    };

                    var containerInstructions = function(info) {
                        var result = {before:'', after:''};
                        switch (info.containerType) {
                            case 'pane' :
                                result.before = '<pane heading="' + info.title + '" active="' + (info.active || 'false') + '">';
                                result.after = '</pane>';
                                break;
                            case 'tab' :
                                result.before = '<tabs>';
                                result.after = '</tabs>';
                                break;
                            case 'well' :
                                result.before = '<div class="well">';
                                if (info.title) {
                                    result.before += '<h4>' + info.title + '</h4>';
                                }
                                result.after = '</div>';
                                break;
                            case 'well-large' :
                                result.before = '<div class="well well-large">';
                                result.after = '</div>';
                                break;
                            case 'well-small' :
                                result.before = '<div class="well well-small">';
                                result.after = '</div>';
                                break;
                            case 'fieldset' :
                                result.before = '<fieldset>';
                                if (info.title) {
                                    result.before += '<legend>' + info.title + '</legend>';
                                }
                                result.after = '</fieldset>';
                                break;
                            case 'container' :
                                result.before = '<fieldset>';
                                if (info.title) {
                                    result.before += '<a ng-click="toggleFolder(\''+ info.id +'\')" class="container-header"><i class="icon-folder-open ' + info.id + '"></i>';
                                    result.before +=  info.title ;
                                    result.before += '</a><i class="icon-plus-sign"></i>';

                                }
                                processInstructions(info.content, null, info.id);
                                result.after = '</fieldset>';
                                break;
                            case undefined:
                                break;
                            case null:
                                break;
                            case '':
                                break;
                            default:
                                result.before = '<div class="' + info.containerType + '">';
                                if (info.title) {
                                    var titleLook = info.titleTagOrClass || "h4";
                                    if (titleLook.match(/h[1-6]/)) {
                                        result.before += '<' + titleLook + '>' + info.title + '</' + info.titleLook + '>';
                                    } else {
                                        result.before += '<p class="' + titleLook + '">'+ info.title +'</p>'
                                    }
                                }
                                result.after = '</div>';
                                break;
                        }
                        return result;
                    };

                    var generateLabel = function (fieldInfo, addButtonMarkup) {
                        var labelHTML = '';
                        if ((attrs.formstyle !== 'inline' && fieldInfo.label !== '') || addButtonMarkup) {
                            labelHTML = '<label';
                            if (isHorizontalStyle(attrs.formstyle)) {
                                labelHTML += ' for="' + fieldInfo.id + '"' + addAll('Label', 'control-label');
                            }
                            labelHTML += '>' + fieldInfo.label + (addButtonMarkup || '') + '</label>';
                        }
                        return labelHTML;
                    };

                    var processSubKey = function(niceName, thisSubkey, schemaDefName, info, subkeyNo) {
                        scope['$_arrayOffset_' + niceName + '_' + subkeyNo] = 0;
                        var topAndTail = containerInstructions(thisSubkey);
                        var markup = topAndTail.before;
                        markup += '<form-input schema="' + schemaDefName + '" subschema="true" formStyle="' + attrs.formstyle + '" subkey="' + schemaDefName+'_subkey" subkeyno = "' + subkeyNo + '"></form-input>';
                        markup += topAndTail.after;
                        return markup;
                    };

                    var handleField = function (info, parentId) {

                        var parentString = (parentId ? ' ui-toggle="showHide' + parentId + '"' : '')
                        , styling = isHorizontalStyle(attrs.formstyle)
                        , template = styling ? '<div' + addAll("Group", 'control-group') + parentString + ' id="cg_' + info.id + '">' : '<span ' + parentString + ' id="cg_' + info.id + '">';
                        if (info.schema) {
                            //schemas (which means they are arrays in Mongoose)

                            var niceName = info.name.replace(/\./g,'_');
                            var schemaDefName = '$_schema_' + niceName;
                            scope[schemaDefName] = info.schema;

                            // Check for subkey - selecting out one or more of the array
                            if (info.subkey) {
                                info.subkey.path = info.name;
                                scope[schemaDefName+'_subkey'] = info.subkey;

                                if (angular.isArray(info.subkey)) {
                                    for (var arraySel = 0 ; arraySel < info.subkey.length; arraySel++) {
                                        template += processSubKey(niceName, info.subkey[arraySel], schemaDefName, info, arraySel);
                                    }
                                } else {
                                    template += processSubKey(niceName, info.subkey, schemaDefName, info, '0');
                                }
                                subkeys.push(info);
                            } else {
                                template += '<div class="schema-head">' + info.label + '</div>' +
                                    '<div ng-form class="' + convertFormStyleToClass(info.formStyle) + '" name="form_' + niceName + '{{$index}}" class="sub-doc well" id="' + info.id + 'List_{{$index}}" ng-repeat="subDoc in record.' + info.name + ' track by $index">' +
                                    '<div class="row-fluid sub-doc">' +
                                    '<div class="pull-left">' +
                                    '<form-input schema="' + schemaDefName + '" subschema="true" formStyle="' + info.formStyle + '"></form-input>' +
                                    '</div>';

                                if (!info.noRemove) {
                                    template += '<div class="pull-left sub-doc-btns">' +
                                        '<button id="remove_' + info.id + '_btn" class="btn btn-mini form-btn" ng-click="remove(\''+info.name+'\',$index)">' +
                                        '<i class="icon-minus"></i> Remove' +
                                        '</button>' +
                                        '</div> '
                                }

                                template += '</div>' +
                                    '</div>' +
                                    '<div class = "schema-foot">';
                                if (!info.noAdd) {
                                    template += '<button id="add_' + info.id + '_btn" class="btn btn-mini form-btn" ng-click="add(\''+info.name+'\')">' +
                                        '<i class="icon-plus"></i> Add' +
                                        '</button>'
                                }
                                template += '</div>';
                            }
                        } else {
                            // Handle arrays here
                            var controlClass = (isHorizontalStyle(attrs.formstyle)) ? ' class="controls"' : '';
                            if (info.array) {
                                if (attrs.formstyle === 'inline') throw "Cannot use arrays in an inline form";
                                template += generateLabel(info, ' <i id="add_' + info.id + '" ng-click="add(\''+info.name+'\')" class="icon-plus-sign"></i>') +
                                    '<div '+controlClass+' id="' + info.id + 'List" ng-repeat="arrayItem in record.' + info.name + '">' +
                                    generateInput(info, "arrayItem.x", true, info.id + '_{{$index}}') +
                                    '<i ng-click="remove(\''+info.name+'\',$index)" id="remove_' + info.id + '_{{$index}}" class="icon-minus-sign"></i>' +
                                    '</div>';
                            } else {
                                // Single fields here
                                template += generateLabel(info);
                                if (controlClass !== '') template += '<div '+controlClass+'>';
                                template += generateInput(info, null, attrs.required, info.id);
                                if (controlClass !== '') template += '</div>';
                            }
                        }
                        template += styling ? '</div>' : '</span>';
                        return template;
                    };

                    var processInstructions = function (instructionsArray, topLevel, groupId) {
                        for (var anInstruction = 0; anInstruction < instructionsArray.length; anInstruction++) {
                            var info = instructionsArray[anInstruction];
                            if (anInstruction === 0  && topLevel && !attrs.schema.match(/$_schema_/)) {
                                info.add = (info.add || '');
                                if (info.add.indexOf('ui-date') == -1) {
                                    info.add = info.add + "autofocus ";
                                }
                            }
                            var callHandleField = true;
                            if (info.directive) {
                                var directiveName = info.directive;
                                var newElement = '<' + directiveName;
                                var thisElement = element[0];
                                for (var i = 0; i < thisElement.attributes.length; i++) {
                                    var thisAttr = thisElement.attributes[i];
                                    switch (thisAttr.nodeName) {
                                        case 'ng-repeat' :
                                            break;
                                        case 'class' :
                                            var classes = thisAttr.nodeValue.replace('ng-scope', '');
                                            if (classes.length > 0) {
                                                newElement += ' class="' + classes + '"';
                                            }
                                            break;
                                        case 'schema' :
                                            var options = angular.copy(info);
                                            delete options.directive;
                                            var bespokeSchemaDefName = ('bespoke_' + info.name).replace(/\./g,'_');
                                            newElement += ' ng-init="' + bespokeSchemaDefName + '=[' + JSON.stringify(options).replace(/\"/g,"'") + ']" schema="' + bespokeSchemaDefName + '"';
                                            break;
                                        default :
                                            newElement += ' ' + thisAttr.nodeName + '="' + thisAttr.nodeValue + '"';
                                    }
                                }
                                newElement += '></' + directiveName + '>';
                                elementHtml += newElement;
                                callHandleField = false;
                            } else if (info.containerType) {
                                var parts = containerInstructions(info);
                                switch (info.containerType) {
                                    case 'pane' :
                                        // maintain support for simplified pane syntax for now
                                        if (!tabsSetup) {
                                            tabsSetup = 'forced';
                                            elementHtml += '<tabs>';
                                        }

                                        elementHtml += parts.before;
                                        processInstructions(info.content);
                                        elementHtml += parts.after;
                                        break;
                                    case 'tab' :
                                        tabsSetup = true;
                                        elementHtml += parts.before;
                                        processInstructions(info.content);
                                        elementHtml += parts.after;
                                        break;
                                    case 'container' :
                                        elementHtml += parts.before;
                                        processInstructions(info.content, null, info.id);
                                        elementHtml += parts.after;
                                        break;
                                    default:
                                        // includes wells, fieldset
                                        elementHtml += parts.before;
                                        processInstructions(info.content);
                                        elementHtml += parts.after;
                                        break;
                                }
                                callHandleField = false;
                            } else if (attrs.subkey) {
                                // Don't do fields that form part of the subkey
                                var objectToSearch = angular.isArray(scope[attrs.subkey]) ? scope[attrs.subkey][0].keyList : scope[attrs.subkey].keyList;
                                if (_.find(objectToSearch, function(value, key){return scope[attrs.subkey].path + '.' + key === info.name})) {
                                    callHandleField = false;
                                }
                            }
                            if (callHandleField) {
                                if (groupId) {
                                    scope['showHide' + groupId] = true;
                                }
                                elementHtml += handleField(info, groupId);
                            }
                            // Todo - find a better way of communicating with controllers
                        }
                    };

                    var unwatch = scope.$watch(attrs.schema, function (newValue) {
                        if (newValue) {
                            if (!angular.isArray(newValue)) {
                                newValue = [newValue];   // otherwise some old tests stop working for no real reason
                            }
                            if (newValue.length > 0) {
                                unwatch();
                                elementHtml = '';
                                processInstructions(newValue, true);
                                if (tabsSetup === 'forced') {
                                    elementHtml += '</tabs>';
                                }
                                element.replaceWith($compile(elementHtml)(scope));

                                // If there are subkeys we need to fix up ng-model references when record is read
                                if (subkeys.length > 0) {

                                    var unwatch2 = scope.$watch('phase', function (newValue) {
                                        if (newValue === 'ready') {
                                            unwatch2();
                                            for (var subkeyCtr = 0 ; subkeyCtr < subkeys.length ; subkeyCtr ++) {
                                                var info = subkeys[subkeyCtr],
                                                    arrayOffset,
                                                    matching,
                                                    arrayToProcess;

                                                if (!angular.isArray(info.subkey)) {
                                                    arrayToProcess = [info.subkey];
                                                } else {
                                                    arrayToProcess = info.subkey;
                                                }
                                                for (var thisOffset = 0; thisOffset < arrayToProcess.length; thisOffset++) {
                                                    var thisSubkeyList = arrayToProcess[thisOffset].keyList;
                                                    var dataVal = scope.record[info.name] = scope.record[info.name] || [];
                                                    for (arrayOffset = 0; arrayOffset < dataVal.length; arrayOffset++) {
                                                        matching = true;
                                                        for (var keyField in thisSubkeyList) {
                                                            if (thisSubkeyList.hasOwnProperty(keyField)) {
                                                                // Not (currently) concerned with objects here - just simple types
                                                                if (dataVal[arrayOffset][keyField] !== thisSubkeyList[keyField]) {
                                                                    matching = false;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        if (matching) {
                                                            break;
                                                        }
                                                    }
                                                    if (!matching) {
                                                        // There is no matching array element - we need to create one
                                                        arrayOffset = scope.record[info.name].push(thisSubkeyList) - 1;
                                                    }
                                                    scope['$_arrayOffset_' + info.name.replace(/\./g,'_') + '_' + thisOffset] = arrayOffset;
                                                }
                                            }
                                        }
                                    });
                                }

                                $rootScope.$broadcast('formInputDone');

                                if (scope.updateDataDependentDisplay) {
                                    // If this is not a test force the data dependent updates to the DOM
                                    scope.updateDataDependentDisplay(scope.record, null, true);
                                }
                            }
                        }

                    }, true);

                    function addAll (type, additionalClasses) {

                        var action = 'getAddAll' + type + 'Options';

                        return utils[action](scope, attrs, additionalClasses) || [];

                    }
                }
            }
        }
    }]);

formsAngular

.directive('hideOnEmpty', function() {
    return {
        
        replace: false,

        link: function (scope, element, attrs) {

            //if its a hide group, then its not the group but the input

            if (element.hasClass('control-group')) {

                if (element.find('input').length > 0) {


                    if (scope.$eval(element.find('input').prop('attributes').getNamedItem('ng-model').value) === undefined) {

                        element.hide();

                    }

                }

                if (element.find('textarea').length > 0) {

                    if (scope.$eval(element.find('textarea').prop('attributes').getNamedItem('ng-model').value) === undefined) {

                        element.hide();

                    }

                }

                

            } else {

                if (scope.$eval(attrs.ngModel) === undefined) {

                    element.hide();

                }
            }
        }

    };
});
var COL_FIELD = /COL_FIELD/g;
formsAngular.directive('ngTotalCell', ['$compile', '$domUtilityService', function ($compile, domUtilityService) {
    var ngTotalCell = {
        scope: false,
        compile: function() {
            return {
                pre: function($scope, iElement) {
                    var html;
// ellText" ng-class="col.colIndex()"><span ng-cell-text>{{COL_FIELD |number}}</s
// ellText" ng-class="col.colIndex()"><span ng-cell-text>{{COL_FIELD }}</s
                    var cellTemplate,
                        filterMatch = $scope.col.cellTemplate.match(/{{COL_FIELD \|(.+)}}/);
                    if (filterMatch) {
                        cellTemplate = $scope.col.cellTemplate.replace('COL_FIELD |' + filterMatch[1], 'getTotalVal("' + $scope.col.field + '","' + filterMatch[1] + '")');
                    } else {
                        cellTemplate = $scope.col.cellTemplate.replace(COL_FIELD, 'getTotalVal("' + $scope.col.field + '")');
                    }

                    if ($scope.col.enableCellEdit) {
                        html =  $scope.col.cellEditTemplate;
                        html = html.replace(DISPLAY_CELL_TEMPLATE, cellTemplate);
                        html = html.replace(EDITABLE_CELL_TEMPLATE, $scope.col.editableCellTemplate.replace(COL_FIELD, 'row.entity.' + $scope.col.field));
                    } else {
                        html = cellTemplate;
                    }

                    var cellElement = $compile(html)($scope);

                    if ($scope.enableCellSelection && cellElement[0].className.indexOf('ngSelectionCell') === -1) {
                        cellElement[0].setAttribute('tabindex', 0);
                        cellElement.addClass('ngCellElement');
                    }

                    iElement.append(cellElement);
                },
                post: function($scope, iElement) {
                    if ($scope.enableCellSelection) {
                        $scope.domAccessProvider.selectionHandlers($scope, iElement);
                    }

                    $scope.$on('ngGridEventDigestCell', function() {
                        domUtilityService.digest($scope);
                    });
                }
            };
        }
    };

    return ngTotalCell;
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
                    if (locationSplit[1] == 'analyse') {
                        lastObject.analyse = true;
                        lastObject.modelName = locationSplit[2];
                    } else {
                        lastObject.modelName = locationSplit[1];
                        var lastPart = locationSplit[locationParts - 1];
                        if (lastPart === "new") {
                            lastObject.newRecord = true;
                            locationParts--;
                        } else if (lastPart === "edit") {
                            locationParts = locationParts - 2;
                            lastObject.id = locationSplit[locationParts];
                        }
                        if (locationParts > 2) {
                           lastObject.formName = locationSplit[2];
                        }
                    }
                }
            }
            return lastObject;
        }
    }]);


formsAngular.service('utils', function() {


    this.getAddAllGroupOptions = function(scope, attrs, classes) {
        return getAddAllOptions(scope, attrs, "Group", classes);
    }

    this.getAddAllFieldOptions = function(scope, attrs, classes) {
        return getAddAllOptions(scope, attrs, "Field", classes);
    }

    this.getAddAllLabelOptions = function(scope, attrs, classes) {
        return getAddAllOptions(scope, attrs, "Label", classes);
    }

    function getAddAllOptions(scope, attrs, type, classes) {

        

        var addAllOptions = []
        , classList = []
        , tmp
        , options;

       type = "addAll" + type;

        if (typeof(classes) === 'string') {
            tmp = classes.split(' ');
            for (var i = 0; i < tmp.length; i++) {
                classList.push(tmp[i]);
            }
        }

        function getAllOptions(obj) {

            for (var key in obj) {
                if (key === type) {
                    addAllOptions.push(obj[key]);
                }

                if (key === "$parent") {
                    getAllOptions(obj[key]);
                }
            }
        }

        getAllOptions(scope);

        if (attrs[type] !== undefined) {

            if (typeof(attrs[type]) === "object") {

                //support objects...

            } else if (typeof(attrs[type]) === "string") {

                var tmp = attrs[type].split(' ');

                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].indexOf('class=') === 0) {
                        classList.push(tmp[i].substring(6, tmp[i].length));
                    } else {
                        addAllOptions.push(tmp[i]);
                    }
                }
            } else {
                // return false; //error?
            }
        }

        if (classList.length > 0) {
            classes = ' class="' + classList.join(" ") + '" ';
        } else {
            classes = " ";
        }

        if (addAllOptions.length > 0) {
            options = addAllOptions.join(" ") + " ";
        } else {
            options = "";
        }

        return classes + options;

    }
});
function ngGridCsvExportPlugin (opts) {
    var self = this;
    self.grid = null;
    self.scope = null;

    self.init = function(scope, grid, services) {

        function doDownloadButton() {
            var fp = angular.element('h1').parent();
            var csvDataLinkPrevious = angular.element('#csv-data-link');
            if (csvDataLinkPrevious != null) {csvDataLinkPrevious.remove() ; }
            var csvDataLinkHtml = "<button id=\"csv-data-link\" class=\"btn\"><a href=\"data:text/csv;charset=UTF-8,";
            csvDataLinkHtml += encodeURIComponent(self.prepareCSV());
            csvDataLinkHtml += "\" download=\"Export.csv\">CSV Export</button>" ;
            fp.append(csvDataLinkHtml);
        }

        self.grid = grid;
        self.scope = scope;

        if (!opts.inhibitButton) {
            setTimeout(doDownloadButton, 0);
            scope.catHashKeys = function() {
                var hash = '';
                for (var idx in scope.renderedRows) {
                    hash += scope.renderedRows[idx].$$hashKey;
                }
                return hash;
            };
            scope.$watch('catHashKeys()', doDownloadButton);
        }
    };

    self.createCSV = function() {
        window.open('data:text/csv;charset=UTF-8,'+encodeURIComponent(self.prepareCSV()));
    };

    self.prepareCSV = function() {

        function csvStringify(str) {
            if (str == null) { // we want to catch anything null-ish, hence just == not ===
                return '';
            }
            if (typeof(str) === 'number') {
                return '' + str;
            }
            if (typeof(str) === 'boolean') {
                return (str ? 'TRUE' : 'FALSE') ;
            }
            if (typeof(str) === 'string') {
                return str.replace(/"/g,'""');
            }

            return JSON.stringify(str).replace(/"/g,'""');
        }

        function swapLastCommaForNewline(str) {
            var newStr = str.substr(0,str.length - 1);
            return newStr + "\n";
        }

        var csvData = '';
        angular.forEach(self.scope.columns, function (col) {
            if (col.visible) {
                csvData += '"' + csvStringify(col.displayName) + '",';
            }
        });

        csvData = swapLastCommaForNewline(csvData);

        angular.forEach(self.grid.filteredRows, function (row) {
            angular.forEach(self.scope.columns, function (col) {
                if (col.visible) {
                    csvData += '"' + csvStringify(row.entity[col.field]) + '",';
                }
            });
            csvData = swapLastCommaForNewline(csvData);
        });

        return csvData;
    };
}

/*
    An early version of this was submitted as a PR to the nggrid project.  This version depends on jspdf having footers
    (which was also submitted as a PR to that project).  If jspdf PR is accepted then we can submit this to nggrid again,
    but that would require putting the totals (ngGridTotalCell.js) into a plugin.
 */

function ngGridPdfExportPlugin (options) {
    var self = this;
    self.grid = null;
    self.scope = null;
    self.services = null;
    self.options = options;

    self.init = function (scope, grid, services) {
        self.grid = grid;
        self.scope = scope;
        self.services = services;

        if (!options.inhibitButton) {
            var fp = grid.$root.find(".ngFooterPanel");
            var pdfDataLinkPrevious = grid.$root.find('.ngFooterPanel .pdf-data-link-span');
            if (pdfDataLinkPrevious != null) {pdfDataLinkPrevious.remove() ; }
            var pdfDataLinkHtml = '<button class="pdf-data-link-span">PDF Export</button>' ;
            fp.append(pdfDataLinkHtml);
            fp.on('click', function() {
                self.createPDF();
            });
        }
    };

    self.createPDF = function () {
        var headers = [],
            data = [],
            footers = {},
            gridWidth = self.scope.totalRowWidth();

        angular.forEach(self.scope.columns, function (col) {
            if (col.visible) {
                headers.push({name: col.field, prompt:col.displayName, width: col.width * (185 / gridWidth), align: (col.colDef.align || 'left')});
                if (col.colDef.totalsRow) {
                    footers[col.field] = self.scope.getTotalVal(col.field, col.filter);
                }
            }
        });

        angular.forEach(self.grid.filteredRows, function (row) {
            data.push(angular.copy(row.entity));
        });

        var doc = new jsPDF();
        doc.cellInitialize();
        doc.table(data, headers, footers, {printHeaders: true, autoSize: false, autoStretch: false});
        doc.output('dataurlnewwindow');
    };
}
