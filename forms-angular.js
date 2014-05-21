/*! forms-angular 2014-05-21 */
'use strict';

var formsAngular = angular.module('formsAngular', [
  'ngRoute',
  'ngSanitize',
  'ui.select2',
  'ui.date',
  'ui.bootstrap',
  'ngGrid',
  'infinite-scroll',
  'monospaced.elastic',
  'ngCkeditor'
]);

void(formsAngular);  // Make jshint happy
'use strict';

formsAngular.controller('AnalysisCtrl', ['$locationParse', '$filter', '$scope', '$http', '$location', '$routeParams', 'urlService',
  function ($locationParse, $filter, $scope, $http, $location, $routeParams, urlService) {
  /*jshint newcap: false */
  var firstTime = true,
    pdfPlugIn = new ngGridPdfExportPlugin({inhibitButton: true}),
    csvPlugIn = new ngGridCsvExportPlugin({inhibitButton: true});
  /*jshint newcap: true */

  angular.extend($scope, $routeParams);
  $scope.reportSchema = {};
  $scope.gridOptions = {
    columnDefs: 'reportSchema.columnDefs',
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
        url = urlService.buildUrl(url.replace(/\|.+?\|/g, function (match) {
          var param = match.slice(1, -1),
            isParamTest = /\((.+)\)/.exec(param);
          return isParamTest ? $scope.reportSchema.params[isParamTest[1]].value : rowItem.entity[param];
        }));
        window.location = url;
      }
    },
    footerTemplate: '<div ng-show="gridOptions.reallyShowFooter" class="ngFooterPanel" ng-class="{\'ui-widget-content\': jqueryUITheme, \'ui-corner-bottom\': jqueryUITheme}" ' +
      'ng-style="footerStyle()">' +
      '<div ng-show="gridOptions.showTotals" ng-style="{height: rowHeight+3}">' +
      '<div ng-style="{ \'cursor\': row.cursor }" ng-repeat="col in renderedColumns" ng-class="col.colIndex()" class="ngCell ngTotalCell {{col.cellClass}}">' +
      '<div class="ngVerticalBar" ng-style="{height: rowHeight}" ng-class="{ ngVerticalBarVisible: !$last }">&nbsp;</div>' +
      '<div ng-total-cell></div>' +
      ' </div>' +
      '</div>' +
      '<div class="ngTotalSelectContainer" >' +
      '<div class="ngFooterTotalItems" ng-class="{\'ngNoMultiSelect\': !multiSelect}" >' +
      '<span class="ngLabel">{{i18n.ngTotalItemsLabel}} {{maxRows()}}</span><span ng-show="filterText.length > 0" class="ngLabel">' +
      '({{i18n.ngShowingItemsLabel}} {{totalFilteredItemsLength()}})</span>' +
      '</div>' +
      '<div class="ngFooterSelectedItems" ng-show="multiSelect">' +
      '  <span class="ngLabel">{{i18n.ngSelectedItemsLabel}} {{selectedItems.length}}</span>' +
      '</div>' +
      '</div>' +
      '<div class="ngPagerContainer" style="float: right; margin-top: 10px;" ng-show="enablePaging" ng-class="{\'ngNoMultiSelect\': !multiSelect}">' +
      '<div style="float:left; margin-right: 10px;" class="ngRowCountPicker">' +
      '<span style="float: left; margin-top: 3px;" class="ngLabel">{{i18n.ngPageSizeLabel}}</span>' +
      '<select style="float: left;height: 27px; width: 100px" ng-model="pagingOptions.pageSize" >' +
      '<option ng-repeat="size in pagingOptions.pageSizes">{{size}}</option>' +
      '</select>' +
      '</div>' +
      '<div style="float:left; margin-right: 10px; line-height:25px;" class="ngPagerControl" style="float: left; min-width: 135px;">' +
      '<button class="ngPagerButton" ng-click="pageToFirst()" ng-disabled="cantPageBackward()" title="{{i18n.ngPagerFirstTitle}}">' +
      '<div class="ngPagerFirstTriangle"><div class="ngPagerFirstBar"></div></div></button>' +
      '<button class="ngPagerButton" ng-click="pageBackward()" ng-disabled="cantPageBackward()" title="{{i18n.ngPagerPrevTitle}}">' +
      '<div class="ngPagerFirstTriangle ngPagerPrevTriangle"></div></button>' +
      '<input class="ngPagerCurrent" min="1" max="{{maxPages()}}" type="number" style="width:50px; height: 24px; margin-top: 1px; padding: 0 4px;" ng-model="pagingOptions.currentPage"/>' +
      '<button class="ngPagerButton" ng-click="pageForward()" ng-disabled="cantPageForward()" title="{{i18n.ngPagerNextTitle}}">' +
      '<div class="ngPagerLastTriangle ngPagerNextTriangle"></div></button>' +
      '<button class="ngPagerButton" ng-click="pageToLast()" ng-disabled="cantPageToLast()" title="{{i18n.ngPagerLastTitle}}">' +
      '<div class="ngPagerLastTriangle"><div class="ngPagerLastBar"></div></div></button>' +
      '</div>' +
      '</div>' +
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
        throw new Error('No report instructions specified');
    }
  }

  $scope.getTotalVal = function (field, filter) {
    var result = '',
      instructions = _.find($scope.reportSchema.columnDefs, function (col) {
        return col.field === field;
      });

    if (instructions) {
      switch (instructions.totalsRow) {
        case undefined :
          break;
        case '$SUM' :
          var sum = 0;
          for (var j = 0; j < $scope.report.length; j++) {
            sum += $scope.report[j][field];
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

  $scope.$on('exportToPDF', function () {
    pdfPlugIn.createPDF();
  });

  $scope.$on('exportToCSV', function () {
    csvPlugIn.createCSV();
  });

  $scope.refreshQuery = function () {

    var apiCall = '/api/report/' + $scope.model,
      connector = '?';
    if ($scope.reportSchemaName) {
      apiCall += '/' + $scope.reportSchemaName;
    }

    if ($scope.paramSchema) {
      // we are using the params form
      for (var paramVal in $scope.record) {
        if ($scope.record.hasOwnProperty(paramVal)) {
          var instructions = $scope.reportSchema.params[paramVal];
          if ($scope.record[paramVal] && $scope.record[paramVal] !== '') {
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
        apiCall += connector + query[0].slice(1);
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
              for (var i = 0; i < newValue.length; i++) {
                if (newValue[i].totalsRow) {
                  columnTotals = true;
                }
                if (newValue[i].align) {
                  var alignClass = 'fng-' + newValue[i].align;
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
          }, true);

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
                    id: 'fp_' + param,
                    label: thisPart.label || $filter('titleCase')(param),
                    type: thisPart.type || 'text',
                    required: true,
                    add: thisPart.add || undefined,
                    size: thisPart.size || 'small'
                  });
                  if (thisPart.type === 'select') {
                    // TODO: Remove when select and select2 is modified during the restructure
                    $scope[param + '_Opts'] = thisPart.enum;
                    $scope.paramSchema[newLen - 1].options = param + '_Opts';
                  }
                }
                var dateTest = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3})(Z|[+ -]\d{4})$/.exec(thisPart.value);
                if (dateTest) {
                  thisPart.value = (moment(dateTest[1]).format('YYYY-MM-DDTHH:mm:ss.SSS')) + 'Z';
                }
                $scope.record[param] = thisPart.value;
              }
            }
            $scope.$watch('record', function (newValue, oldValue) {
              if (oldValue !== newValue) {
                $scope.refreshQuery();
              }
            }, true);

          }
        }
      } else {
        console.log(JSON.stringify(data));
        $scope.reportSchema.title = 'Error - see console log';
      }
    }).error(function (err) {
      console.log(JSON.stringify(err));
      $location.path('/404');
    });
  };

  $scope.refreshQuery();

}]);



'use strict';

formsAngular.controller('BaseCtrl', ['$scope', '$routeParams', '$location', '$http', '$filter', '$data', '$locationParse', '$modal', '$window', 'urlService',
  function ($scope, $routeParams, $location, $http, $filter, $data, $locationParse, $modal, $window, urlService) {
    var master = {};
    var fngInvalidRequired = 'fng-invalid-required';
    var sharedStuff = $data;
    var allowLocationChange = true;   // Set when the data arrives..

    sharedStuff.baseScope = $scope;
    $scope.record = sharedStuff.record;
    $scope.phase = 'init';
    $scope.disableFunctions = sharedStuff.disableFunctions;
    $scope.dataEventFunctions = sharedStuff.dataEventFunctions;
    $scope.topLevelFormName = undefined;
    $scope.formSchema = [];
    $scope.tabs = [];
    $scope.listSchema = [];
    $scope.recordList = [];
    $scope.dataDependencies = {};
    $scope.select2List = [];
    $scope.pageSize = 20;
    $scope.pagesLoaded = 0;
    angular.extend($scope, $locationParse($location.$$path));

    $scope.formPlusSlash = $scope.formName ? $scope.formName + '/' : '';
    $scope.modelNameDisplay = sharedStuff.modelNameDisplay || $filter('titleCase')($scope.modelName);
    $scope.generateEditUrl = function (obj) {
      return urlService.buildUrl($scope.modelName + '/' + $scope.formPlusSlash + obj._id + '/edit');
    };

    $scope.walkTree = function (object, fieldname, element) {
      // Walk through subdocs to find the required key
      // for instance walkTree(master,'address.street.number',element)
      // called by getData and setData

      // element is used when accessing in the context of a input, as the id (like exams-2-grader)
      // gives us the element of an array (one level down only for now)
      // TODO: nesting breaks this
      var parts = fieldname.split('.'),
        higherLevels = parts.length - 1,
        workingRec = object;

      for (var i = 0; i < higherLevels; i++) {
        workingRec = workingRec[parts[i]];
        if (angular.isArray(workingRec)) {
          // If we come across an array we need to find the correct position
          workingRec = workingRec[element.scope().$index];
        }
        if (!workingRec) {
          break;
        }
      }
      return {lastObject: workingRec, key: workingRec ? parts[higherLevels] : undefined};
    };

    $scope.getData = function (object, fieldname, element) {
      var leafData = $scope.walkTree(object, fieldname, element);
      return (leafData.lastObject && leafData.key) ? leafData.lastObject[leafData.key] : undefined;
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
      return (inst.id || 'f_' + inst.name).replace(/\./g, '_') + suffix;
    };

    var handleFieldType = function (formInstructions, mongooseType, mongooseOptions) {

        var select2ajaxName;
        if (mongooseType.caster) {
          formInstructions.array = true;
          mongooseType = mongooseType.caster;
          $.extend(mongooseOptions, mongooseType.options);
        }
        if (mongooseType.instance === 'String') {
          if (mongooseOptions.enum) {
            formInstructions.type = formInstructions.type || 'select';
            // Hacky way to get required styling working on select controls
            if (mongooseOptions.required) {

              $scope.$watch('record.' + formInstructions.name, function (newValue) {
                updateInvalidClasses(newValue, formInstructions.id, formInstructions.select2);
              }, true);
              setTimeout(function () {
                updateInvalidClasses($scope.record[formInstructions.name], formInstructions.id, formInstructions.select2);
              }, 0);
            }
            if (formInstructions.select2) {
              $scope['select2' + formInstructions.name] = {
                allowClear: !mongooseOptions.required,
                initSelection: function (element, callback) {
                  callback(element.select2('data'));
                },
                query: function (query) {
                  var data = {results: []},
                    searchString = query.term.toUpperCase();
                  for (var i = 0; i < mongooseOptions.enum.length; i++) {
                    if (mongooseOptions.enum[i].toUpperCase().indexOf(searchString) !== -1) {
                      data.results.push({id: i, text: mongooseOptions.enum[i]});
                    }
                  }
                  query.callback(data);
                }
              };
              _.extend($scope['select2' + formInstructions.name], formInstructions.select2);
              formInstructions.select2.s2query = 'select2' + formInstructions.name;
              $scope.select2List.push(formInstructions.name);
            } else {
              formInstructions.options = suffixCleanId(formInstructions, 'Options');
              $scope[formInstructions.options] = mongooseOptions.enum;
            }
          } else {
            if (!formInstructions.type) {
              formInstructions.type = (formInstructions.name.toLowerCase().indexOf('password') !== -1) ? 'password' : 'text';
            }
            if (mongooseOptions.match) {
              formInstructions.add = 'pattern="' + mongooseOptions.match + '" ' + (formInstructions.add || '');
            }
          }
        } else if (mongooseType.instance === 'ObjectID') {
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
                    var theId = element.val();
                    if (theId && theId !== '') {
                      $http.get('/api/' + mongooseOptions.ref + '/' + theId + '/list').success(function (data) {
                        if (data.success === false) {
                          $location.path('/404');
                        }
                        var display = {id: theId, text: data.list};
                        $scope.setData(master, formInstructions.name, element, display);
                        // stop the form being set to dirty
                        var modelController = element.inheritedData('$ngModelController'),
                          isClean = modelController.$pristine;
                        if (isClean) {
                          // fake it to dirty here and reset after callback()
                          modelController.$pristine = false;
                        }
                        callback(display);
                        if (isClean) {
                          modelController.$pristine = true;
                        }
                      }).error(function () {
                        $location.path('/404');
                      });
//                                } else {
//                                    throw new Error('select2 initSelection called without a value');
                    }
                  },
                  ajax: {
                    url: '/api/search/' + mongooseOptions.ref,
                    data: function (term, page) { // page is the one-based page number tracked by Select2
                      return {
                        q: term, //search term
                        pageLimit: 10, // page size
                        page: page // page number
                      };
                    },
                    results: function (data) {
                      return {results: data.results, more: data.moreCount > 0};
                    }
                  }
                };
                _.extend($scope[select2ajaxName], formInstructions.select2);
                formInstructions.select2.fngAjax = select2ajaxName;
              } else {
                if (formInstructions.select2 === true) {
                  formInstructions.select2 = {};
                }
                $scope['select2' + formInstructions.name] = {
                  allowClear: !mongooseOptions.required,
                  initSelection: function (element, callback) {
                    var myId = element.val();
                    if (myId !== '' && $scope[formInstructions.ids].length > 0) {
                      var myVal = convertIdToListValue(myId, $scope[formInstructions.ids], $scope[formInstructions.options], formInstructions.name);
                      var display = {id: myId, text: myVal};
                      callback(display);
                    }
                  },
                  query: function (query) {
                    var data = {results: []},
                      searchString = query.term.toUpperCase();
                    for (var i = 0; i < $scope[formInstructions.options].length; i++) {
                      if ($scope[formInstructions.options][i].toUpperCase().indexOf(searchString) !== -1) {
                        data.results.push({id: $scope[formInstructions.ids][i], text: $scope[formInstructions.options][i]});
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
        } else if (mongooseType.instance === 'Date') {
          if (!formInstructions.type) {
            if (formInstructions.readonly) {
              formInstructions.type = 'text';
            } else {
              formInstructions.type = 'text';
              formInstructions.add = 'ui-date ui-date-format ';
            }
          }
        } else if (mongooseType.instance === 'boolean') {
          formInstructions.type = 'checkbox';
        } else if (mongooseType.instance === 'Number') {
          formInstructions.type = 'number';
          if (mongooseOptions.min) {
            formInstructions.add = 'min="' + mongooseOptions.min + '" ' + (formInstructions.add || '');
          }
          if (mongooseOptions.max) {
            formInstructions.add = 'max="' + mongooseOptions.max + '" ' + (formInstructions.add || '');
          }
          if (formInstructions.step) {
            formInstructions.add = 'step="' + formInstructions.step + '" ' + (formInstructions.add || '');
          }
        } else {
          throw new Error('Field ' + formInstructions.name + ' is of unsupported type ' + mongooseType.instance);
        }
        if (mongooseOptions.required) {
          formInstructions.required = true;
        }
        if (mongooseOptions.readonly) {
          formInstructions.readonly = true;
        }
        return formInstructions;
      }
      ;

    // TODO: Do this in form
    var basicInstructions = function (field, formData, prefix) {
      formData.name = prefix + field;
//        formData.id = formData.id || 'f_' + prefix + field.replace(/\./g, '_');
//        formData.label = (formData.hasOwnProperty('label') && formData.label) == null ? '' : (formData.label || $filter('titleCase')(field));
      return formData;
    };

    var handleListInfo = function (destList, listOptions, field) {
      var listData = listOptions || {hidden: true};
      if (!listData.hidden) {
        if (typeof listData === 'object') {
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
          if (destForm[i].type === 'text') {
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
          throw new Error('Unable to generate a title for ' + description);
        }
      }
    };

    var evaluateConditional = function (condition, data) {

      function evaluateSide(side) {
        var result = side;
        if (typeof side === 'string' && side.slice(0, 1) === '$') {
          var sideParts = side.split('.');
          switch (sideParts.length) {
            case 1:
              result = $scope.getListData(data, side.slice(1));
              break;
            case 2 :
              // this is a sub schema element, and the appropriate array element has been passed
              result = $scope.getListData(data, sideParts[1]);
              break;
            default:
              throw new Error('Unsupported showIf format');
          }
        }
        return result;
      }

      var lhs = evaluateSide(condition.lhs),
        rhs = evaluateSide(condition.rhs),
        result;

      switch (condition.comp) {
        case 'eq' :
          result = (lhs === rhs);
          break;
        case 'ne' :
          result = (lhs !== rhs);
          break;
        default :
          throw new Error('Unsupported comparator ' + condition.comp);
      }
      return result;
    };

//    Conditionals
//    $scope.dataDependencies is of the form {fieldName1: [fieldId1, fieldId2], fieldName2:[fieldId2]}

    var handleConditionals = function (condInst, name) {

      var dependency = 0;

      function handleVar(theVar) {
        if (typeof theVar === 'string' && theVar.slice(0, 1) === '$') {
          var fieldName = theVar.slice(1);
          var fieldDependencies = $scope.dataDependencies[fieldName] || [];
          fieldDependencies.push(name);
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
        record = '';
      }
      return record;
    };

    // Conventional view is that this should go in a directive.  I reckon it is quicker here.
    $scope.updateDataDependentDisplay = function (curValue, oldValue, force) {
      var depends, i, j, k, element;

      var forceNextTime;
      for (var field in $scope.dataDependencies) {
        if ($scope.dataDependencies.hasOwnProperty(field)) {
          var parts = field.split('.');
          // TODO: what about a simple (non array) subdoc?
          if (parts.length === 1) {
            if (force || !oldValue || curValue[field] !== oldValue[field]) {
              depends = $scope.dataDependencies[field];
              for (i = 0; i < depends.length; i += 1) {
                var name = depends[i];
                for (j = 0; j < $scope.formSchema.length; j += 1) {
                  if ($scope.formSchema[j].name === name) {
                    element = angular.element('#cg_' + $scope.formSchema[j].id);
                    if (evaluateConditional($scope.formSchema[j].showIf, curValue)) {
                      element.removeClass('ng-hide');
                    } else {
                      element.addClass('ng-hide');
                    }
                  }
                }
              }
            }
          } else if (parts.length === 2) {
            if (forceNextTime === undefined) {
              forceNextTime = true;
            }
            if (curValue[parts[0]]) {
              for (k = 0; k < curValue[parts[0]].length; k++) {
                // We want to carry on if this is new array element or it is changed
                if (force || !oldValue || !oldValue[parts[0]] || !oldValue[parts[0]][k] || curValue[parts[0]][k][parts[1]] !== oldValue[parts[0]][k][parts[1]]) {
                  depends = $scope.dataDependencies[field];
                  for (i = 0; i < depends.length; i += 1) {
                    var nameParts = depends[i].split('.');
                    if (nameParts.length !== 2) { throw new Error('Conditional display must control dependent fields at same level '); }
                    for (j = 0; j < $scope.formSchema.length; j += 1) {
                      if ($scope.formSchema[j].name === nameParts[0]) {
                        var subSchema = $scope.formSchema[j].schema;
                        for (var l = 0; l < subSchema.length; l++) {
                          if (subSchema[l].name === depends[i]) {
                            element = angular.element('#f_' + nameParts[0] + 'List_' + k + ' #cg_f_' + depends[i].replace('.', '_'));
                            if (element.length === 0) {
                              // Test Plait care plan structures if you change next line
                              element = angular.element('#f_elements-' + k + '-' + nameParts[1]);
                            } else {
                              forceNextTime = false;  // Because the sub schema has been rendered we don't need to do this again until the record changes
                            }
                            if (element.length > 0) {
                              if (evaluateConditional($scope.formSchema[j].schema[l].showIf, curValue[parts[0]][k])) {
                                element.show();
                              } else {
                                element.hide();
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            // TODO: this needs rewrite for nesting
            throw new Error('You can only go down one level of subdocument with showIf');
          }
        }
      }
      return forceNextTime;
    };

    var handleSchema = function (description, source, destForm, destList, prefix, doRecursion) {

      function handletabInfo(tabName, thisInst) {
        var tabTitle = angular.copy(tabName);
        var tab = _.find($scope.tabs, function (atab) {
          return atab.title === tabTitle;
        });
        if (!tab) {
          if ($scope.tabs.length === 0) {
            if ($scope.formSchema.length > 0) {
              $scope.tabs.push({title: 'Main', content: []});
              tab = $scope.tabs[0];
              for (var i = 0; i < $scope.formSchema.length; i++) {
                tab.content.push($scope.formSchema[i]);
              }
            }
          }
          tab = $scope.tabs[$scope.tabs.push({title: tabTitle, containerType: 'tab', content: []}) - 1];
        }
        tab.content.push(thisInst);
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
                if (formData.tab) { handletabInfo(formData.tab, sectionInstructions); }
                if (formData.order !== undefined) {
                  destForm.splice(formData.order, 0, sectionInstructions);
                } else {
                  destForm.push(sectionInstructions);
                }
              }
            } else {
              if (destForm) {
                var formInstructions = basicInstructions(field, formData, prefix);
                if (handleConditionals(formInstructions.showIf, formInstructions.name) && field !== 'options') {
                  var formInst = handleFieldType(formInstructions, mongooseType, mongooseOptions);
                  if (formInst.tab) { handletabInfo(formInst.tab, formInst); }
                  if (formData.order !== undefined) {
                    destForm.splice(formData.order, 0, formInst);
                  } else {
                    destForm.push(formInst);
                  }
                }
              }
              if (destList) {
                handleListInfo(destList, mongooseOptions.list, field);
              }
            }
          }
        }
      }
//        //if a hash is defined then make that the selected tab is displayed
//        if ($scope.tabs.length > 0 && $location.hash()) {
//            var tab = _.find($scope.tabs, function (atab) {
//                return atab.title === $location.hash();
//            });
//
//            if (tab) {
//                for (var i = 0; i < $scope.tabs.length; i++) {
//                    $scope.tabs[i].active = false;
//                }
//                tab.active = true;
//            }
//        }
//
//        //now add a hash for the active tab if none exists
//        if ($scope.tabs.length > 0 && !$location.hash()) {
//            console.log($scope.tabs[0]['title'])
//            $location.hash($scope.tabs[0]['title']);
//        }

      if (destList && destList.length === 0) {
        handleEmptyList(description, destList, destForm, source);
      }
    };

    $scope.processServerData = function (recordFromServer) {
      master = convertToAngularModel($scope.formSchema, recordFromServer, 0);
      $scope.phase = 'ready';
      $scope.cancel();
    };

    $scope.readRecord = function () {
      $http.get('/api/' + $scope.modelName + '/' + $scope.id).success(function (data) {
        if (data.success === false) {
          $location.path('/404');
        }
        allowLocationChange = false;
        $scope.phase = 'reading';
        if (typeof $scope.dataEventFunctions.onAfterRead === 'function') {
          $scope.dataEventFunctions.onAfterRead(data);
        }
        $scope.processServerData(data);
      }).error(function () {
        $location.path('/404');
      });
    };

    function generateListQuery() {
      var queryString = '?l=' + $scope.pageSize,
        addParameter = function (param, value) {
          if (value && value !== '') {
            queryString += '&' + param + '=' + value;
          }
        };

      addParameter('f', $routeParams.f);
      addParameter('a', $routeParams.a);
      addParameter('o', $routeParams.o);
      addParameter('s', $scope.pagesLoaded * $scope.pageSize);
      $scope.pagesLoaded++;
      return queryString;
    }

    $scope.scrollTheList = function () {
      $http.get('/api/' + $scope.modelName + generateListQuery()).success(function (data) {
        if (angular.isArray(data)) {
          $scope.recordList = $scope.recordList.concat(data);
        } else {
          $scope.showError(data, 'Invalid query');
        }
      }).error(function () {
        $location.path('/404');
      });
    };

    $http.get('/api/schema/' + $scope.modelName + ($scope.formName ? '/' + $scope.formName : ''), {cache: true}).success(function (data) {

      handleSchema('Main ' + $scope.modelName, data, $scope.formSchema, $scope.listSchema, '', true);

      if (!$scope.id && !$scope.newRecord) { //this is a list. listing out contents of a collection
        allowLocationChange = true;
      } else {
        var force = true;
        $scope.$watch('record', function (newValue, oldValue) {
          if (newValue !== oldValue) {
            force = $scope.updateDataDependentDisplay(newValue, oldValue, force);
          }
        }, true);

        if ($scope.id) {
          // Going to read a record
          if (typeof $scope.dataEventFunctions.onBeforeRead === 'function') {
            $scope.dataEventFunctions.onBeforeRead($scope.id, function (err) {
              if (err) {
                $scope.showError(err);
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
      $location.path('/404');
    });

    $scope.setPristine = function () {
      $scope.dismissError();
      if ($scope[$scope.topLevelFormName]) {
        $scope[$scope.topLevelFormName].$setPristine();
      }
    };

    $scope.cancel = function () {

      for (var prop in $scope.record) {
        if ($scope.record.hasOwnProperty(prop)) {
          delete $scope.record[prop];
        }
      }

      $.extend(true, $scope.record, master);
      $scope.setPristine();
    };

    //listener for any child scopes to display messages
    // pass like this:
    //    scope.$emit('showErrorMessage', {title: 'Your error Title', body: 'The body of the error message'});
    // or
    //    scope.$broadcast('showErrorMessage', {title: 'Your error Title', body: 'The body of the error message'});
    $scope.$on('showErrorMessage', function (event, args) {
      $scope.showError(args.body, args.title);
    });

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
            errorMessage += '</li>';
          }
        }
        if (errorMessage.length > 0) {
          errorMessage = data.message + '<br /><ul>' + errorMessage + '</ul>';
        } else {
          errorMessage = data.message || 'Error!  Sorry - No further details available.';
        }
        $scope.showError(errorMessage);
      } else {
        $scope.showError(status + ' ' + JSON.stringify(data));
      }
    };

    $scope.showError = function (errString, alertTitle) {
      $scope.alertTitle = alertTitle ? alertTitle : 'Error!';
      $scope.errorMessage = errString;
    };

    $scope.dismissError = function () {
      delete $scope.errorMessage;
    };

    $scope.createNew = function (dataToSave, options) {
      $http.post('/api/' + $scope.modelName, dataToSave).success(function (data) {
        if (data.success !== false) {
          if (typeof $scope.dataEventFunctions.onAfterCreate === 'function') {
            $scope.dataEventFunctions.onAfterCreate(data);
          }
          if (options.redirect) {
            $window.location = options.redirect;
          } else {
            $location.path('/' + $scope.modelName + '/' + $scope.formPlusSlash + data._id + '/edit');
            //                    reset?
          }
        } else {
          $scope.showError(data);
        }
      }).error(handleError);
    };

    $scope.updateDocument = function (dataToSave, options) {
      $scope.phase = 'updating';
      $http.post('/api/' + $scope.modelName + '/' + $scope.id, dataToSave).success(function (data) {
        if (data.success !== false) {
          if (typeof $scope.dataEventFunctions.onAfterUpdate === 'function') {
            $scope.dataEventFunctions.onAfterUpdate(data, master);
          }
          if (options.redirect) {
            if (options.allowChange) {
              allowLocationChange = true;
            }
            $window.location = options.redirect;
          } else {
            $scope.processServerData(data);
            $scope.setPristine();
          }
        } else {
          $scope.showError(data);
        }
      }).error(handleError);

    };

    $scope.save = function (options) {
      options = options || {};

      //Convert the lookup values into ids
      var dataToSave = convertToMongoModel($scope.formSchema, angular.copy($scope.record), 0);
      if ($scope.id) {
        if (typeof $scope.dataEventFunctions.onBeforeUpdate === 'function') {
          $scope.dataEventFunctions.onBeforeUpdate(dataToSave, master, function (err) {
            if (err) {
              $scope.showError(err);
            } else {
              $scope.updateDocument(dataToSave, options);
            }
          });
        } else {
          $scope.updateDocument(dataToSave, options);
        }
      } else {
        if (typeof $scope.dataEventFunctions.onBeforeCreate === 'function') {
          $scope.dataEventFunctions.onBeforeCreate(dataToSave, function (err) {
            if (err) {
              $scope.showError(err);
            } else {
              $scope.createNew(dataToSave, options);
            }
          });
        } else {
          $scope.createNew(dataToSave, options);
        }
      }
    };

    $scope.new = function () {
      $location.search('');
      $location.path('/' + $scope.modelName + '/' + $scope.formPlusSlash + 'new');
    };

    $scope.deleteRecord = function (model, id) {
      $http.delete('/api/' + model + '/' + id).success(function () {
        if (typeof $scope.dataEventFunctions.onAfterDelete === 'function') {
          $scope.dataEventFunctions.onAfterDelete(master);
        }
        $location.path('/' + $scope.modelName);
      });
    };

    $scope.$on('$locationChangeStart', function (event, next) {
      if (!allowLocationChange && !$scope.isCancelDisabled()) {
        event.preventDefault();
        var modalInstance = $modal.open({
          template: '<div class="modal-header">' +
            '   <h3>Record modified</h3>' +
            '</div>' +
            '<div class="modal-body">' +
            '   <p>Would you like to save your changes?</p>' +
            '</div>' +
            '<div class="modal-footer">' +
            '    <button class="btn btn-primary dlg-yes" ng-click="yes()">Yes</button>' +
            '    <button class="btn btn-warning dlg-no" ng-click="no()">No</button>' +
            '    <button class="btn dlg-cancel" ng-click="cancel()">Cancel</button>' +
            '</div>',
          controller: 'SaveChangesModalCtrl',
          backdrop: 'static'
        });

        modalInstance.result.then(
          function (result) {
            if (result) {
              $scope.save({redirect: next, allowChange: true});    // save changes
            } else {
              allowLocationChange = true;
              $window.location = next;
            }
          }
        );
      }
    });

    $scope.delete = function () {
      if ($scope.record._id) {
        var modalInstance = $modal.open({
          template: '<div class="modal-header">' +
            '   <h3>Delete Item</h3>' +
            '</div>' +
            '<div class="modal-body">' +
            '   <p>Are you sure you want to delete this record?</p>' +
            '</div>' +
            '<div class="modal-footer">' +
            '    <button class="btn btn-primary dlg-no" ng-click="cancel()">No</button>' +
            '    <button class="btn btn-warning dlg-yes" ng-click="yes()">Yes</button>' +
            '</div>',
          controller: 'SaveChangesModalCtrl',
          backdrop: 'static'
        });

        modalInstance.result.then(
          function (result) {
            if (result) {
              if (typeof $scope.dataEventFunctions.onBeforeDelete === 'function') {
                $scope.dataEventFunctions.onBeforeDelete(master, function (err) {
                  if (err) {
                    $scope.showError(err);
                  } else {
                    $scope.deleteRecord($scope.modelName, $scope.id);
                  }
                });
              } else {
                $scope.deleteRecord($scope.modelName, $scope.id);
              }
            }
          }
        );
      }
    };

    $scope.isCancelDisabled = function () {
      if (typeof $scope.disableFunctions.isCancelDisabled === 'function') {
        return $scope.disableFunctions.isCancelDisabled($scope.record, master, $scope[$scope.topLevelFormName]);
      } else {
        return $scope[$scope.topLevelFormName] && $scope[$scope.topLevelFormName].$pristine;
      }
    };

    $scope.isSaveDisabled = function () {
      if (typeof $scope.disableFunctions.isSaveDisabled === 'function') {
        return $scope.disableFunctions.isSaveDisabled($scope.record, master, $scope[$scope.topLevelFormName]);
      } else {
        return ($scope[$scope.topLevelFormName] && ($scope[$scope.topLevelFormName].$invalid || $scope[$scope.topLevelFormName].$pristine));
      }
    };

    $scope.isDeleteDisabled = function () {
      if (typeof $scope.disableFunctions.isDeleteDisabled === 'function') {
        return $scope.disableFunctions.isDeleteDisabled($scope.record, master, $scope[$scope.topLevelFormName]);
      } else {
        return (!$scope.id);
      }
    };

    $scope.isNewDisabled = function () {
      if (typeof $scope.disableFunctions.isNewDisabled === 'function') {
        return $scope.disableFunctions.isNewDisabled($scope.record, master, $scope[$scope.topLevelFormName]);
      } else {
        return false;
      }
    };

    $scope.disabledText = function (localStyling) {
      var text = '';
      if ($scope.isSaveDisabled) {
        text = 'This button is only enabled when the form is complete and valid.  Make sure all required inputs are filled in. ' + localStyling;
      }
      return text;
    };

    $scope.skipCols = function (index) {
      return index > 0 ? 'col-md-offset-2' : '';
    };

    $scope.setFormDirty = function (event) {
      if (event) {
        var form = angular.element(event.target).inheritedData('$formController');
        form.$setDirty();
      } else {
        console.log('setFormDirty called without an event (fine in a unit test)');
      }
    };

    $scope.add = function (fieldName, $event) {
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
      $scope.setFormDirty($event);
    };

    $scope.remove = function (fieldName, value, $event) {
      // Remove an element from an array
      var fieldParts = fieldName.split('.');
      var arrayField = $scope.record;
      for (var i = 0, l = fieldParts.length; i < l; i++) {
        arrayField = arrayField[fieldParts[i]];
      }
      arrayField.splice(value, 1);
      $scope.setFormDirty($event);
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
        portion[fieldDetails[0]] = fn(theValue);
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
              thisField[k] = {x: thisField[k] };
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
                }
              });
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
              thisField[k] = thisField[k].x;
            }
          }

          // Convert {lookup:'List description for 012abcde'} to {lookup:'012abcde'}
          var idList = $scope[suffixCleanId(schema[i], '_ids')];
          if (idList && idList.length > 0) {
            updateObject(fieldname, anObject, function (value) {
              return convertToForeignKeys(schema[i], value, $scope[suffixCleanId(schema[i], 'Options')], idList);
            });
          } else if (schema[i].select2) {
            var lookup = $scope.getData(anObject, fieldname, null);
            if (schema[i].select2.fngAjax) {
              if (lookup && lookup.id) {
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
      } else if (schemaElement.select2) {
        return {id: input, text: convertIdToListValue(input, ids, values, schemaElement.name)};
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
        throw new Error('convertIdToListValue: Invalid data - id ' + id + ' not found in ' + idsArray + ' processing ' + fname);
      }
      return valuesArray[index];
    };

    var convertListValueToId = function (value, valuesArray, idsArray, fname) {
      var textToConvert = _.isObject(value) ? (value.x || value.text) : value;
      if (textToConvert && textToConvert.match(/^[0-9a-f]{24}$/)) {
        return textToConvert;  // a plugin probably added this
      } else {
        var index = valuesArray.indexOf(textToConvert);
        if (index === -1) {
          throw new Error('convertListValueToId: Invalid data - value ' + textToConvert + ' not found in ' + valuesArray + ' processing ' + fname);
        }
        return idsArray[index];
      }
    };

    var setUpSelectOptions = function (lookupCollection, schemaElement) {
      var optionsList = $scope[schemaElement.options] = [];
      var idList = $scope[schemaElement.ids] = [];
      $http.get('/api/schema/' + lookupCollection, {cache: true}).success(function (data) {
        var listInstructions = [];
        handleSchema('Lookup ' + lookupCollection, data, null, listInstructions, '', false);
        $http.get('/api/' + lookupCollection, {cache: true}).success(function (data) {
          if (data) {
            for (var i = 0; i < data.length; i++) {
              var option = '';
              for (var j = 0; j < listInstructions.length; j++) {
                option += data[i][listInstructions[j].name] + ' ';
              }
              option = option.trim();
              var pos = _.sortedIndex(optionsList, option);
              // handle dupes (ideally people will use unique indexes to stop them but...)
              if (optionsList[pos] === option) {
                option = option + '    (' + data[i]._id + ')';
                pos = _.sortedIndex(optionsList, option);
              }
              optionsList.splice(pos, 0, option);
              idList.splice(pos, 0, data[i]._id);
            }
            updateRecordWithLookupValues(schemaElement);
          }
        });
      });
    };

    var updateRecordWithLookupValues = function (schemaElement) {
      // Update the master and the record with the lookup values
      if (!$scope.topLevelFormName || $scope[$scope.topLevelFormName].$pristine) {
        updateObject(schemaElement.name, master, function (value) {
          return convertForeignKeys(schemaElement, value, $scope[suffixCleanId(schemaElement, 'Options')], $scope[suffixCleanId(schemaElement, '_ids')]);
        });
        // TODO This needs a rethink - it is a quick workaround.  See https://trello.com/c/q3B7Usll
        if (master[schemaElement.name]) {
          $scope.record[schemaElement.name] = master[schemaElement.name];
        }
      }
    };

// Open a select2 control from the appended search button
    $scope.openSelect2 = function (ev) {
      $('#' + $(ev.currentTarget).data('select2-open')).select2('open');
    };

    $scope.toJSON = function (obj) {
      return JSON.stringify(obj, null, 2);
    };

    $scope.baseSchema = function () {
      return ($scope.tabs.length ? $scope.tabs : $scope.formSchema);
    };

  }
])
  .controller('SaveChangesModalCtrl', ['$scope', '$modalInstance', function ($scope, $modalInstance) {
    $scope.yes = function () {
      $modalInstance.close(true);
    };
    $scope.no = function () {
      $modalInstance.close(false);
    };
    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }]);
'use strict';

formsAngular.controller('ModelCtrl', [ '$scope', '$http', '$location', 'urlService', function ($scope, $http, $location, urlService) {

  $scope.models = [];
  $http.get('/api/models').success(function (data) {
    $scope.models = data;
  }).error(function () {
    $location.path('/404');
  });

  $scope.newUrl = function (model) {
    return urlService.buildUrl(model + '/new');
  };

  $scope.listUrl = function (model) {
    return urlService.buildUrl(model);
  };

}]);

'use strict';

formsAngular.controller('NavCtrl',
  ['$scope', '$data', '$location', '$filter', '$locationParse', '$controller', 'urlService', 'cssFrameworkService',
    function ($scope, $data, $location, $filter, $locationParse, $controller, urlService, cssFrameworkService) {

  $scope.items = [];

  $scope.globalShortcuts = function (event) {
    if (event.keyCode === 191 && event.ctrlKey) {
      // Ctrl+/ takes you to global search
      var searchInput = angular.element.find('input')[0];
      if (searchInput && angular.element(searchInput).attr('id') === 'searchinput') {
        // check that global search directive is in use
        angular.element(searchInput).focus();
        event.preventDefault();
      }
    }
  };

  $scope.css = function (fn, arg) {
    var result;
    if (typeof cssFrameworkService[fn] === 'function') {
      result = cssFrameworkService[fn](arg);
    } else {
      result = 'error text-error';
    }
    return result;
  };

  function loadControllerAndMenu(controllerName, level) {
    var locals = {}, addThis;

    controllerName += 'Ctrl';
    locals.$scope = $scope.scopes[level] = $scope.$new();
    try {
      $controller(controllerName, locals);
      if ($scope.routing.newRecord) {
        addThis = 'creating';
      } else if ($scope.routing.id) {
        addThis = 'editing';
      } else {
        addThis = 'listing';
      }
      if (angular.isObject(locals.$scope.contextMenu)) {
        angular.forEach(locals.$scope.contextMenu, function (value) {
          if (value[addThis]) {
            $scope.items.push(value);
          }
        });
      }
    }
    catch (error) {
      // Check to see if error is no such controller - don't care
      if (!(/is not a function, got undefined/.test(error.message))) {
        console.log('Unable to instantiate ' + controllerName + ' - ' + error.message);
      }
    }
  }

  $scope.$on('$locationChangeSuccess', function () {

    $scope.routing = $locationParse($location.$$path);

    $scope.items = [];

    if ($scope.routing.analyse) {
      $scope.contextMenu = 'Report';
      $scope.items = [
        {
          broadcast: 'exportToPDF',
          text: 'PDF'
        },
        {
          broadcast: 'exportToCSV',
          text: 'CSV'
        }
      ];
    } else if ($scope.routing.modelName) {

      angular.forEach($scope.scopes, function (value) {
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
      $scope.$broadcast($scope.items[index].broadcast);
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
  };

  $scope.isHidden = function (index) {
    return $scope.items[index].isHidden ? $scope.items[index].isHidden() : false;
  };

  $scope.buildUrl = function (path) {
    return urlService.buildUrl(path);
  };

}]);

'use strict';
formsAngular
  .directive('formButtons', ['cssFrameworkService', function (cssFrameworkService) {
    return {
      restrict: 'A',
      templateUrl: 'template/form-button-' + cssFrameworkService.framework() + '.html'
    };
  }]);

'use strict';

formsAngular
  .directive('formInput', ['$compile', '$rootScope', 'utils', '$filter', 'urlService', 'cssFrameworkService', function ($compile, $rootScope, utils, $filter, urlService, cssFrameworkService) {
    return {
      restrict: 'EA',
      link: function (scope, element, attrs) {
//                generate markup for bootstrap forms
//
//                Bootstrap 3
//                Horizontal (default)
//                <div class="form-group">
//                    <label for="inputEmail3" class="col-sm-2 control-label">Email</label>
//                    <div class="col-sm-10">
//                        <input type="email" class="form-control" id="inputEmail3" placeholder="Email">
//                    </div>
//                 </div>
//
//                Vertical
//                <div class="form-group">
//                    <label for="exampleInputEmail1">Email address</label>
//                    <input type="email" class="form-control" id="exampleInputEmail1" placeholder="Enter email">
//                </div>
//
//                Inline
//                <div class="form-group">
//                    <label class="sr-only" for="exampleInputEmail2">Email address</label>
//                    <input type="email" class="form-control" id="exampleInputEmail2" placeholder="Enter email">
//                </div>

//                Bootstrap 2
//                Horizontal (default)
//                <div class="control-group">
//                    <label class="control-label" for="inputEmail">Email</label>
//                    <div class="controls">
//                        <input type="text" id="inputEmail" placeholder="Email">
//                    </div>
//                </div>
//
//                Vertical
//                <label>Label name</label>
//                <input type="text" placeholder="Type something…">
//                <span class="help-block">Example block-level help text here.</span>
//
//                Inline
//                <input type="text" class="input-small" placeholder="Email">

        var sizeMapping = [1, 2, 4, 6, 8, 10, 12],
          sizeDescriptions = ['mini', 'small', 'medium', 'large', 'xlarge', 'xxlarge', 'block-level'],
          defaultSizeOffset = 2, // medium, which was the default for Twitter Bootstrap 2
          subkeys = [],
          tabsSetup = false;

        var isHorizontalStyle = function (formStyle) {
          return (!formStyle || formStyle === 'undefined' || ['vertical', 'inline'].indexOf(formStyle) === -1);
        };

        var generateNgShow = function (showWhen, model) {

          function evaluateSide(side) {
            var result = side;
            if (typeof side === 'string') {
              if (side.slice(0, 1) === '$') {
                result = (model || 'record') + '.';
                var parts = side.slice(1).split('.');
                if (parts.length > 1) {
                  var lastBit = parts.pop();
                  result += parts.join('.') + '[$index].' + lastBit;
                } else {
                  result += side.slice(1);
                }
              } else {
                result = '\'' + side + '\'';
              }
            }
            return result;
          }

          var conditionText = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
            conditionSymbols = ['===', '!==', '>', '>=', '<', '<='],
            conditionPos = conditionText.indexOf(showWhen.comp);

          if (conditionPos === -1) { throw new Error('Invalid comparison in showWhen'); }
          return evaluateSide(showWhen.lhs) + conditionSymbols[conditionPos] + evaluateSide(showWhen.rhs);
        };

        var generateDefault = function (common, options, fieldInfo) {
          var result = '<input ' + common + 'type="' + fieldInfo.type + '"';
          if (options.formstyle === 'inline' && cssFrameworkService.framework() === 'bs2' && !fieldInfo.size) {
            result += 'class="input-small"';
          }
          result += ' />';
          return result;
        };

        var generateInput = function (fieldInfo, modelString, isRequired, idString, options) {
          var nameString;
          if (!modelString) {
            modelString = (options.model || 'record') + '.';
            if (options.subschema && fieldInfo.name.indexOf('.') !== -1) {
              // Schema handling - need to massage the ngModel and the id
              var compoundName = fieldInfo.name,
                lastPartStart = compoundName.lastIndexOf('.'),
                lastPart = compoundName.slice(lastPartStart + 1);
              if (options.index) {
                var cut = modelString.length;
                modelString += compoundName.slice(0, lastPartStart) + '.' + options.index + '.' + lastPart;
                idString = 'f_' + modelString.slice(cut).replace(/\./g, '-');
              } else {
                modelString += compoundName.slice(0, lastPartStart);
                if (options.subkey) {
                  modelString += '[' + '$_arrayOffset_' + compoundName.slice(0, lastPartStart).replace(/\./g, '_') + '_' + options.subkeyno + '].' + lastPart;
                  idString = compoundName + '_subkey';
                } else {
                  modelString += '[$index].' + lastPart;
                  idString = null;
                  nameString = compoundName.replace(/\./g, '-');
                }
              }
            } else {
              modelString += fieldInfo.name;
            }
          }
          var value,
            requiredStr = (isRequired || fieldInfo.required) ? ' required' : '',
            readonlyStr = fieldInfo.readonly ? ' readonly' : '',
            placeHolder = fieldInfo.placeHolder,
            compactClass = '',
            sizeClassBS3 = '',
            sizeClassBS2 = '',
            formControl = '';

          if (cssFrameworkService.framework() === 'bs3') {
            compactClass = (['horizontal', 'vertical', 'inline'].indexOf(options.formstyle) === -1) ? ' input-sm' : '';
            sizeClassBS3 = 'col-xs-' + sizeMapping[fieldInfo.size ? sizeDescriptions.indexOf(fieldInfo.size) : defaultSizeOffset];
            formControl = ' form-control';
          } else {
            sizeClassBS2 = (fieldInfo.size ? ' input-' + fieldInfo.size : '');
          }

          if (options.formstyle === 'inline') { placeHolder = placeHolder || fieldInfo.label; }
          var common = 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '" ' : ' name="' + nameString + '" ');
          common += (placeHolder ? ('placeholder="' + placeHolder + '" ') : '');
          if (fieldInfo.popup) {
            common += 'title="' + fieldInfo.popup + '" ';
          }
          common += addAll('Field', null, options);
          switch (fieldInfo.type) {
            case 'select' :
              common += (fieldInfo.readonly ? 'disabled ' : '');
              if (fieldInfo.select2) {
                common += 'class="fng-select2' + formControl + compactClass + sizeClassBS2 + '"';
                if (fieldInfo.select2.fngAjax) {
                  if (cssFrameworkService.framework() === 'bs2') {
                    value = '<div class="input-append">';
                    value += '<input ui-select2="' + fieldInfo.select2.fngAjax + '" ' + common + '>';
                    value += '<button class="btn" type="button" data-select2-open="' + idString + '" ng-click="openSelect2($event)"><i class="icon-search"></i></button>';
                    value += '</div>';
                  } else {
                    value = '<div class="input-group">';
                    value += '<input ui-select2="' + fieldInfo.select2.fngAjax + '" ' + common + '>';
                    value += '<span class="input-group-addon' + compactClass + '" data-select2-open="' + idString + '" ';
                    value += '    ng-click="openSelect2($event)"><i class="glyphicon glyphicon-search"></i></span>';
                    value += '</div>';
                  }
                } else if (fieldInfo.select2) {
                  value = '<input ui-select2="' + fieldInfo.select2.s2query + '" ' + (fieldInfo.readonly ? 'disabled ' : '') + common + '>';
                }
              } else {
                value = '<select ' + common + 'class="' + formControl.trim() + compactClass + sizeClassBS2 + '">';
                if (!isRequired) {
                  value += '<option></option>';
                }
                if (angular.isArray(fieldInfo.options)) {
                  angular.forEach(fieldInfo.options, function (optValue) {
                    value += '<option>' + optValue + '</option>';
                  });
                } else {
                  value += '<option ng-repeat="option in ' + fieldInfo.options + '">{{option}}</option>';
                }
                value += '</select>';
              }
              break;
            case 'link' :
              value = '<a ng-href="/' + urlService.buildUrl('') + fieldInfo.ref + (fieldInfo.form ? '/' + fieldInfo.form : '') + '/{{ ' + modelString + '}}/edit">' + fieldInfo.linkText + '</a>';
              break;
            case 'radio' :
              value = '';
              var separateLines = (options.formstyle !== 'inline' && !fieldInfo.inlineRadio);

              if (angular.isArray(fieldInfo.options)) {
                if (options.subschema) { common = common.replace('name="', 'name="{{$index}}-'); }
                angular.forEach(fieldInfo.options, function (optValue) {
                  value += '<input ' + common + 'type="radio"';
                  value += ' value="' + optValue + '">' + optValue;
                  if (separateLines) { value += '<br />'; }
                });
              } else {
                var tagType = separateLines ? 'div' : 'span';
                if (options.subschema) { common = common.replace('$index', '$parent.$index').replace('name="', 'name="{{$parent.$index}}-'); }
                value += '<' + tagType + ' ng-repeat="option in ' + fieldInfo.options + '"><input ' + common + ' type="radio" value="{{option}}"> {{option}} </' + tagType + '> ';
              }
              break;
            case 'checkbox' :
              if (cssFrameworkService.framework() === 'bs3') {
                value = '<div class="checkbox"><input ' + common + 'type="checkbox"></div>';
              } else {
                value = generateDefault(common, options, fieldInfo);
              }
              break;
            default:
              common += 'class="' + formControl.trim() + compactClass + sizeClassBS2 + '"' + (fieldInfo.add ? fieldInfo.add : '');
              common += 'ng-model="' + modelString + '"' + (idString ? ' id="' + idString + '" name="' + idString + '"' : '') + requiredStr + readonlyStr + ' ';
              if (fieldInfo.type === 'textarea') {
                if (fieldInfo.rows) {
                  if (fieldInfo.rows === 'auto') {
                    common += 'msd-elastic="\n" class="ng-animate" ';
                  } else {
                    common += 'rows = "' + fieldInfo.rows + '" ';
                  }
                }
                if (fieldInfo.editor === 'ckEditor') {
                  common += 'ckeditor = "" ';
                  if (cssFrameworkService.framework() === 'bs3') { sizeClassBS3 = 'col-xs-12'; }
                }
                value = '<textarea ' + common + ' />';
              } else {
                value = generateDefault(common, options, fieldInfo);
              }
          }
          if (cssFrameworkService.framework() === 'bs3' && isHorizontalStyle(options.formstyle) && fieldInfo.type !== 'checkbox') {
            value = '<div class="' + sizeClassBS3 + '">' + value + '</div>';
          }
          if (fieldInfo.helpInline && fieldInfo.type !== 'checkbox') {
            value += '<span class="help-inline">' + fieldInfo.helpInline + '</span>';
          }
          if (fieldInfo.help) {
            value += '<span class="help-block ' + sizeClassBS3 + '">' + fieldInfo.help + '</span>';
          }
          return value;
        };

        var convertFormStyleToClass = function (aFormStyle) {
          var result;
          switch (aFormStyle) {
            case 'horizontal' :
              result = 'form-horizontal';
              break;
            case 'vertical' :
              result = '';
              break;
            case 'inline' :
              result = 'form-inline';
              break;
            case 'horizontalCompact' :
              result = 'form-horizontal compact';
              break;
            default:
              result = 'form-horizontal compact';
              break;
          }
          return result;
        };

        var containerInstructions = function (info) {
          var result = {before: '', after: ''};
          if (typeof info.containerType === 'function') {
            result = info.containerType(info);
          } else {
            switch (info.containerType) {
              case 'tab' :
                result.before = '<tab heading="' + info.title + '">';
                result.after = '</tab>';
                break;
              case 'tabset' :
                result.before = '<tabset>';
                result.after = '</tabset>';
                break;
              case 'well' :
                result.before = '<div class="well">';
                if (info.title) {
                  result.before += '<h4>' + info.title + '</h4>';
                }
                result.after = '</div>';
                break;
              case 'well-large' :
                result.before = '<div class="well well-lg well-large">';
                result.after = '</div>';
                break;
              case 'well-small' :
                result.before = '<div class="well well-sm well-small">';
                result.after = '</div>';
                break;
              case 'fieldset' :
                result.before = '<fieldset>';
                if (info.title) {
                  result.before += '<legend>' + info.title + '</legend>';
                }
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
                  var titleLook = info.titleTagOrClass || 'h4';
                  if (titleLook.match(/h[1-6]/)) {
                    result.before += '<' + titleLook + '>' + info.title + '</' + info.titleLook + '>';
                  } else {
                    result.before += '<p class="' + titleLook + '">' + info.title + '</p>';
                  }
                }
                result.after = '</div>';
                break;
            }
          }
          return result;
        };

        var generateLabel = function (fieldInfo, addButtonMarkup, options) {
          var labelHTML = '';
          if ((cssFrameworkService.framework() === 'bs3' || (options.formstyle !== 'inline' && fieldInfo.label !== '')) || addButtonMarkup) {
            labelHTML = '<label';
            if (isHorizontalStyle(options.formstyle)) {
              labelHTML += ' for="' + fieldInfo.id + '"';
              if (cssFrameworkService.framework() === 'bs3') { labelHTML += addAll('Label', 'col-sm-2', options); }
            } else if (options.formstyle === 'inline') {
              labelHTML += ' for="' + fieldInfo.id + '" class="sr-only"';
            }
            labelHTML += addAll('Label', 'control-label', options);
            labelHTML += '>' + fieldInfo.label + (addButtonMarkup || '') + '</label>';
          }
          return labelHTML;
        };

        var handleField = function (info, options) {

          info.type = info.type || 'text';
          info.id = info.id || 'f_' + info.name.replace(/\./g, '_');
          info.label = (info.label !== undefined) ? (info.label === null ? '' : info.label) : $filter('titleCase')(info.name.split('.').slice(-1)[0]);

          var template = '', closeTag = '';
          var classes = '';
          if (cssFrameworkService.framework() === 'bs3') {
            classes = 'form-group';
            if (options.formstyle === 'vertical' && info.size !== 'block-level') {
              template += '<div class="row">';
              classes += ' col-xs-' + sizeMapping[info.size ? sizeDescriptions.indexOf(info.size) : defaultSizeOffset];
              closeTag += '</div>';
            }
            template += '<div' + addAll('Group', classes, options);
            closeTag += '</div>';
          } else {
            if (isHorizontalStyle(options.formstyle)) {
              template += '<div' + addAll('Group', 'control-group', options);
              closeTag = '</div>';
            } else {
              template += '<span ';
              closeTag = '</span>';
            }
          }

          var includeIndex = false;
          if (options.index) {
            try {
              parseInt(options.index);
              includeIndex = true;
            } catch (err) {
              // Nothing to do
            }
          }
          if (info.showWhen) {
            if (typeof info.showWhen === 'string') {
              template += 'ng-show="' + info.showWhen + '"';
            } else {
              template += 'ng-show="' + generateNgShow(info.showWhen, options.model) + '"';
            }
          }
          if (includeIndex) {
            template += ' id="cg_' + info.id.replace('_', '-' + attrs.index + '-') + '">';
          } else {
            template += ' id="cg_' + info.id.replace(/\./g, '-') + '">';
          }

          if (info.schema) {
            var niceName = info.name.replace(/\./g, '_');
            var schemaDefName = '$_schema_' + niceName;
            scope[schemaDefName] = info.schema;
            if (info.schema) { // display as a control group
              //schemas (which means they are arrays in Mongoose)
              // Check for subkey - selecting out one or more of the array
              if (info.subkey) {
                info.subkey.path = info.name;
                scope[schemaDefName + '_subkey'] = info.subkey;

                var subKeyArray = angular.isArray(info.subkey) ? info.subkey : [info.subkey];
                for (var arraySel = 0; arraySel < subKeyArray.length; arraySel++) {
                  var topAndTail = containerInstructions(subKeyArray[arraySel]);
                  template += topAndTail.before;
                  template += processInstructions(info.schema, null, {subschema: true, formStyle: options.formstyle, subkey: schemaDefName + '_subkey', subkeyno: arraySel});
                  template += topAndTail.after;
                }
                subkeys.push(info);
              } else {
                template += '<div class="schema-head">' + info.label +
                  '</div>' +
                  '<div ng-form class="' + (cssFrameworkService.framework() === 'bs2' ? 'row-fluid ' : '') +
                  convertFormStyleToClass(info.formStyle) + '" name="form_' + niceName + '{{$index}}" class="sub-doc well" id="' + info.id + 'List_{{$index}}" ' +
                  ' ng-repeat="subDoc in ' + (options.model || 'record') + '.' + info.name + ' track by $index">' +
                  '   <div class="' + (cssFrameworkService.framework() === 'bs2' ? 'row-fluid' : 'row') + ' sub-doc">' +
                  '      <div class="pull-left">' + processInstructions(info.schema, false, {subschema: true, formstyle: info.formStyle, model: options.model}) +
                  '      </div>';

                if (!info.noRemove || info.customSubDoc) {
                  template += '   <div class="pull-left sub-doc-btns">';
                  if (info.customSubDoc) {
                    template += info.customSubDoc;
                  }
                  if (!info.noRemove) {
                    if (cssFrameworkService.framework() === 'bs2') {
                      template += '      <button name="remove_' + info.id + '_btn" class="remove-btn btn btn-mini form-btn" ng-click="remove(\'' + info.name + '\',$index,$event)">' +
                        '          <i class="icon-minus">';

                    } else {
                      template += '      <button name="remove_' + info.id + '_btn" class="remove-btn btn btn-default btn-xs form-btn" ng-click="remove(\'' + info.name + '\',$index,$event)">' +
                        '          <i class="glyphicon glyphicon-minus">';
                    }
                    template += '          </i> Remove' +
                      '      </button>';
                  }
                  template += '  </div> ';
                }
                template += '   </div>' +
                  '</div>';
                if (!info.noAdd || info.customFooter) {
                  template += '<div class = "schema-foot">';
                  if (info.customFooter) {
                    template += info.customFooter;
                  }
                  if (!info.noAdd) {
                    if (cssFrameworkService.framework() === 'bs2') {
                      template += '    <button id="add_' + info.id + '_btn" class="add-btn btn btn-mini form-btn" ng-click="add(\'' + info.name + '\',$event)">' +
                        '        <i class="icon-plus"></i> Add';
                    } else {
                      template += '    <button id="add_' + info.id + '_btn" class="add-btn btn btn-default btn-xs form-btn" ng-click="add(\'' + info.name + '\',$event)">' +
                        '        <i class="glyphicon glyphicon-plus"></i> Add';
                    }
                    template += '    </button>';
                  }
                  template += '</div>';
                }
              }
            }
          }
          else {
            // Handle arrays here
            var controlClass = [];
            if (isHorizontalStyle(options.formstyle)) {
              controlClass.push(cssFrameworkService.framework() === 'bs2' ? 'controls' : 'col-sm-10');
            }
            if (info.array) {
              controlClass.push('fng-array');
              if (options.formstyle === 'inline') { throw 'Cannot use arrays in an inline form'; }
              if (cssFrameworkService.framework() === 'bs2') {
                template += generateLabel(info, ' <i id="add_' + info.id + '" ng-click="add(\'' + info.name + '\',$event)" class="icon-plus-sign"></i>', options) +
                  '<div class="' + controlClass.join(' ') + '" id="' + info.id + 'List" ng-repeat="arrayItem in ' + (options.model || 'record') + '.' + info.name + '">' +
                  generateInput(info, 'arrayItem.x', true, info.id + '_{{$index}}', options) +
                  '<i ng-click="remove(\'' + info.name + '\',$index,$event)" id="remove_' + info.id + '_{{$index}}" class="icon-minus-sign"></i>' +
                  '</div>';
              } else {
                template += generateLabel(info, ' <i id="add_' + info.id + '" ng-click="add(\'' + info.name + '\',$event)" class="glyphicon glyphicon-plus-sign"></i>', options) +
                  '<div ng-class="skipCols($index)" class="' + controlClass.join(' ') + '" id="' + info.id + 'List" ng-repeat="arrayItem in ' + (options.model || 'record') + '.' + info.name + '">' +
                  generateInput(info, 'arrayItem.x', true, info.id + '_{{$index}}', options) +
                  '<i ng-click="remove(\'' + info.name + '\',$index,$event)" id="remove_' + info.id + '_{{$index}}" class="glyphicon glyphicon-minus-sign"></i>' +
                  '</div>';
              }
            } else {
              // Single fields here
              template += generateLabel(info, null, options);
              if (controlClass.length > 0) { template += '<div class="' + controlClass.join(' ') + '">'; }
              template += generateInput(info, null, options.required, info.id, options);
              if (controlClass.length > 0) { template += '</div>'; }
            }
          }
          template += closeTag;
          return template;
        };

//              var processInstructions = function (instructionsArray, topLevel, groupId) {
//  removing groupId as it was only used when called by containerType container, which is removed for now
        var processInstructions = function (instructionsArray, topLevel, options) {
          var result = '';
          if (instructionsArray) {
            for (var anInstruction = 0; anInstruction < instructionsArray.length; anInstruction++) {
              var info = instructionsArray[anInstruction];
              if (anInstruction === 0 && topLevel && !options.schema.match(/$_schema_/)) {
                info.add = (info.add || '');
                if (info.add.indexOf('ui-date') === -1 && !options.noautofocus && !info.containerType) {
                  info.add = info.add + 'autofocus ';
                }
              }
              var callHandleField = true;
              if (info.directive) {
                var directiveName = info.directive;
                var newElement = '<' + directiveName + ' model="' + (options.model || 'record') + '"';
                var thisElement = element[0];
                for (var i = 0; i < thisElement.attributes.length; i++) {
                  var thisAttr = thisElement.attributes[i];
                  switch (thisAttr.nodeName) {
                    case 'class' :
                      var classes = thisAttr.nodeValue.replace('ng-scope', '');
                      if (classes.length > 0) {
                        newElement += ' class="' + classes + '"';
                      }
                      break;
                    case 'schema' :
                      var bespokeSchemaDefName = ('bespoke_' + info.name).replace(/\./g, '_');
                      scope[bespokeSchemaDefName] = angular.copy(info);
                      delete scope[bespokeSchemaDefName].directive;
                      newElement += ' schema="' + bespokeSchemaDefName + '"';
                      break;
                    default :
                      newElement += ' ' + thisAttr.nodeName + '="' + thisAttr.nodeValue + '"';
                  }
                }
                newElement += '></' + directiveName + '>';
                result += newElement;
                callHandleField = false;
              } else if (info.containerType) {
                var parts = containerInstructions(info);
                switch (info.containerType) {
                  case 'tab' :
                    // maintain support for simplified tabset syntax for now
                    if (!tabsSetup) {
                      tabsSetup = 'forced';
                      result += '<tabset>';
                    }

                    result += parts.before;
                    result += processInstructions(info.content, null, options);
                    result += parts.after;
                    break;
                  case 'tabset' :
                    tabsSetup = true;
                    result += parts.before;
                    result += processInstructions(info.content, null, options);
                    result += parts.after;
                    break;
                  default:
                    // includes wells, fieldset
                    result += parts.before;
                    result += processInstructions(info.content, null, options);
                    result += parts.after;
                    break;
                }
                callHandleField = false;
              } else if (options.subkey) {
                // Don't display fields that form part of the subkey, as they should not be edited (because in these circumstances they form some kind of key)
                var objectToSearch = angular.isArray(scope[options.subkey]) ? scope[options.subkey][0].keyList : scope[options.subkey].keyList;
                if (_.find(objectToSearch, function (value, key) {
                  return scope[options.subkey].path + '.' + key === info.name;
                })) {
                  callHandleField = false;
                }
              }
              if (callHandleField) {
                //                            if (groupId) {
                //                                scope['showHide' + groupId] = true;
                //                            }
                result += handleField(info, options);
              }
            }
          } else {
            console.log('Empty array passed to processInstructions');
            result = '';
          }
          return result;

        };

        var unwatch = scope.$watch(attrs.schema, function (newValue) {
          if (newValue) {
            newValue = angular.isArray(newValue) ? newValue : [newValue];   // otherwise some old tests stop working for no real reason
            if (newValue.length > 0) {
              unwatch();
              var elementHtml = '';
              var theRecord = scope[attrs.model || 'record'];      // By default data comes from scope.record
              if ((attrs.subschema || attrs.model) && !attrs.forceform) {
                elementHtml = '';
              } else {
                scope.topLevelFormName = attrs.name || 'myForm';     // Form name defaults to myForm
                // Copy attrs we don't process into form
                var customAttrs = '';
                for (var thisAttr in attrs) {
                  if (attrs.hasOwnProperty(thisAttr)) {
                    if (thisAttr[0] !== '$' && ['name', 'formstyle', 'schema', 'subschema', 'model'].indexOf(thisAttr) === -1) {
                      customAttrs += ' ' + attrs.$attr[thisAttr] + '="' + attrs[thisAttr] + '"';
                    }
                  }
                }
                elementHtml = '<form name="' + scope.topLevelFormName + '" class="' + convertFormStyleToClass(attrs.formstyle) + ' novalidate"' + customAttrs + '>';
              }
              if (theRecord === scope.topLevelFormName) { throw new Error('Model and Name must be distinct - they are both ' + theRecord); }
              elementHtml += processInstructions(newValue, true, attrs);
              if (tabsSetup === 'forced') {
                elementHtml += '</tabset>';
              }
              elementHtml += attrs.subschema ? '' : '</form>';
              element.replaceWith($compile(elementHtml)(scope));
              // If there are subkeys we need to fix up ng-model references when record is read
              if (subkeys.length > 0) {
                var unwatch2 = scope.$watch('phase', function (newValue) {
                  if (newValue === 'ready') {
                    unwatch2();
                    for (var subkeyCtr = 0; subkeyCtr < subkeys.length; subkeyCtr++) {
                      var info = subkeys[subkeyCtr],
                        arrayOffset,
                        matching,
                        arrayToProcess = angular.isArray(info.subkey) ? info.subkey : [info.subkey];

                      for (var thisOffset = 0; thisOffset < arrayToProcess.length; thisOffset++) {
                        var thisSubkeyList = arrayToProcess[thisOffset].keyList;
                        var dataVal = theRecord[info.name] = theRecord[info.name] || [];
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
                          arrayOffset = theRecord[info.name].push(thisSubkeyList) - 1;
                        }
                        scope['$_arrayOffset_' + info.name.replace(/\./g, '_') + '_' + thisOffset] = arrayOffset;
                      }
                    }
                  }
                });
              }

              $rootScope.$broadcast('formInputDone');

              if (scope.updateDataDependentDisplay && theRecord && Object.keys(theRecord).length > 0) {
                // If this is not a test force the data dependent updates to the DOM
                scope.updateDataDependentDisplay(theRecord, null, true);
              }
            }
          }

        }, true);

        function addAll(type, additionalClasses, options) {
          var action = 'getAddAll' + type + 'Options';
          return utils[action](scope, options, additionalClasses) || [];
        }
      }
    };
  }])
;

'use strict';
var COL_FIELD = /COL_FIELD/g;
formsAngular.directive('ngTotalCell', ['$compile', '$domUtilityService', function ($compile, domUtilityService) {
  var ngTotalCell = {
    scope: false,
    compile: function () {
      return {
        pre: function ($scope, iElement) {
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
            html = $scope.col.cellEditTemplate;
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
        post: function ($scope, iElement) {
          if ($scope.enableCellSelection) {
            $scope.domAccessProvider.selectionHandlers($scope, iElement);
          }

          $scope.$on('ngGridEventDigestCell', function () {
            domUtilityService.digest($scope);
          });
        }
      };
    }
  };

  return ngTotalCell;
}]);



'use strict';

formsAngular.controller('SearchCtrl', ['$scope', '$http', '$location', function ($scope, $http, $location) {

  var currentRequest = '';

  $scope.handleKey = function (event) {
    if (event.keyCode === 27 && $scope.searchTarget.length > 0) {
      $scope.searchTarget = '';
    } else if ($scope.results.length > 0) {
      switch (event.keyCode) {
        case 38:
          // up arrow pressed
          if ($scope.focus > 0) {
            $scope.setFocus($scope.focus - 1);
          }
          if (typeof event.preventDefault === 'function') { event.preventDefault(); }
          break;
        case 40:
          // down arrow pressed
          if ($scope.results.length > $scope.focus + 1) {
            $scope.setFocus($scope.focus + 1);
          }
          if (typeof event.preventDefault === 'function') { event.preventDefault(); }
          break;
        case 13:
          if ($scope.focus != null) {
            $scope.selectResult($scope.focus);
          }
          break;
      }
    }
  };

  $scope.setFocus = function (index) {
    if ($scope.focus !== null) { delete $scope.results[$scope.focus].focussed; }
    $scope.results[index].focussed = true;
    $scope.focus = index;
  };

  $scope.selectResult = function (resultNo) {
    var result = $scope.results[resultNo];
    $location.path('/' + result.resource + '/' + result.id + '/edit');
  };

  $scope.resultClass = function (index) {
    var resultClass = 'search-result';
    if ($scope.results && $scope.results[index].focussed) { resultClass += ' focus'; }
    return resultClass;
  };

  var clearSearchResults = function () {
    $scope.moreCount = 0;
    $scope.errorClass = '';
    $scope.results = [];
    $scope.focus = null;
  };

  $scope.$watch('searchTarget', function (newValue) {
    if (newValue && newValue.length > 0) {
      currentRequest = newValue;
      $http.get('/api/search?q=' + newValue).success(function (data) {
        // Check that we haven't fired off a subsequent request, in which
        // case we are no longer interested in these results
        if (currentRequest === newValue) {
          if ($scope.searchTarget.length > 0) {
            $scope.results = data.results;
            $scope.moreCount = data.moreCount;
            if (data.results.length > 0) {
              $scope.errorClass = '';
              $scope.setFocus(0);
            }
            $scope.errorClass = $scope.results.length === 0 ? 'error' : '';
          } else {
            clearSearchResults();
          }
        }
      }).error(function (data, status) {
        console.log('Error in searchbox.js : ' + data + ' (status=' + status + ')');
      });
    } else {
      clearSearchResults();
    }
  }, true);

  $scope.$on('$routeChangeStart', function () {
    $scope.searchTarget = '';
  });

}])
  .directive('globalSearch', ['cssFrameworkService', function (cssFrameworkService) {
    return {
      restrict: 'AE',
      templateUrl: 'template/search-' + cssFrameworkService.framework() + '.html',
      controller: 'SearchCtrl'
    };
  }
  ]);

'use strict';

formsAngular.filter('titleCase', [function () {
  return function (str, stripSpaces) {
    var value = str
      .replace(/(_|\.)/g, ' ')                       // replace underscores and dots with spaces
      .replace(/[A-Z]/g, ' $&').trim()               // precede replace caps with a space
      .replace(/\w\S*/g, function (txt) {            // capitalise first letter of word
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    if (stripSpaces) {
      value = value.replace(/\s/g, '');
    } else {
      // lose double spaces
      value = value.replace(/\s{2,}/g, ' ');
    }
    return value;
  };
}]);
'use strict';

formsAngular.provider('cssFrameworkService', [function () {
  // Supported options for framework are:
  //      bs2 = Twitter Bootstrap 2.3.2 (default)
  //      bs3 = Bootstrap 3.1.1
  var config = {
    framework: 'bs2'  // Unit tests depend on this being bs2
  };

  return {
    setOptions: function (options) {
      angular.extend(config, options);
    },
    $get: function () {
      return {
        framework: function () {
          return config.framework;
        },
        span: function (cols) {
          var result;
          switch (config.framework) {
            case 'bs2' :
              result = 'span' + cols;
              break;
            case 'bs3' :
              result = 'col-xs-' + cols;
              break;
          }
          return result;
        },
        offset: function (cols) {
          var result;
          switch (config.framework) {
            case 'bs2' :
              result = 'offset' + cols;
              break;
            case 'bs3' :
              result = 'col-lg-offset-' + cols;
              break;
          }
          return result;
        },
        rowFluid: function () {
          var result;
          switch (config.framework) {
            case 'bs2' :
              result = 'row-fluid';
              break;
            case 'bs3' :
              result = 'row';
              break;
          }
          return result;
        }
      };
    }
  };
}]);

'use strict';

formsAngular.factory('$data', [function () {

  var sharedData = {
    record: {},
    disableFunctions: {},
    dataEventFunctions: {}
  };
  return sharedData;

}]);

'use strict';

formsAngular.provider('formRoutes', ['$routeProvider', function ($routeProvider) {

  return {
    setRoutes: function (appRoutes, defaultRoute) {
      // Set up the application specific routes
      for (var i = 0; i < appRoutes.length; i++) {
        $routeProvider.when(appRoutes[i].route, appRoutes[i].options);
      }

      // Set up the forms-angular routes
      $routeProvider
        .when('/analyse/:model/:reportSchemaName', {templateUrl: 'partials/base-analysis.html'})
        .when('/analyse/:model', {templateUrl: 'partials/base-analysis.html'})
        .when('/:model/:id/edit', {templateUrl: 'partials/base-edit.html'})
        .when('/:model/new', {templateUrl: 'partials/base-edit.html'})
        .when('/:model', {templateUrl: 'partials/base-list.html'})
        .when('/:model/:form/:id/edit', {templateUrl: 'partials/base-edit.html'})  // non default form (different fields etc)
        .when('/:model/:form/new', {templateUrl: 'partials/base-edit.html'})       // non default form (different fields etc)
        .when('/:model/:form', {templateUrl: 'partials/base-list.html'})           // list page with links to non default form
        .otherwise({redirectTo: defaultRoute});
    },
    $get: function () {
      return null;
    }
  };
}]);

'use strict';

formsAngular.factory('$locationParse', [function () {

  var lastRoute = null,
    lastObject = {};

  return function (location) {

    if (location !== lastRoute) {
      lastRoute = location;
      var locationSplit = location.split('/');
      var locationParts = locationSplit.length;
      if (locationParts === 2 && locationSplit[1] === 'index') {
        lastObject = {index: true};
      } else {
        lastObject = {newRecord: false};
        if (locationSplit[1] === 'analyse') {
          lastObject.analyse = true;
          lastObject.modelName = locationSplit[2];
        } else {
          lastObject.modelName = locationSplit[1];
          var lastPart = locationSplit[locationParts - 1];
          if (lastPart === 'new') {
            lastObject.newRecord = true;
            locationParts--;
          } else if (lastPart === 'edit') {
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
  };
}]);


'use strict';

formsAngular.provider('urlService', ['$locationProvider', function ($locationProvider) {
  var config = {
    hashPrefix: '',
    html5Mode: false
  };

  return {
    setOptions: function (options) {
      angular.extend(config, options);
      $locationProvider.html5Mode(config.html5Mode);
      if (config.hashPrefix !== '') {
        $locationProvider.hashPrefix(config.hashPrefix);
      }
    },
    $get: function () {
      return {
        buildUrl: function (path) {
          var base = config.html5Mode ? '' : '#';
          base += config.hashPrefix;
          if (base[0]) { base += '/'; }
          return base + path;
        }
      };
    }
  };
}]);
formsAngular.service('utils', function () {

  this.getAddAllGroupOptions = function (scope, attrs, classes) {
    return getAddAllOptions(scope, attrs, "Group", classes);
  };

  this.getAddAllFieldOptions = function (scope, attrs, classes) {
    return getAddAllOptions(scope, attrs, "Field", classes);
  };

  this.getAddAllLabelOptions = function (scope, attrs, classes) {
    return getAddAllOptions(scope, attrs, "Label", classes);
  };

  function getAddAllOptions(scope, attrs, type, classes) {

    var addAllOptions = [],
      classList = [],
      tmp, i, options;

    type = "addAll" + type;

    if (typeof(classes) === 'string') {
      tmp = classes.split(' ');
      for (i = 0; i < tmp.length; i++) {
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

        tmp = attrs[type].split(' ');

        for (i = 0; i < tmp.length; i++) {
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
'use strict';
function ngGridCsvExportPlugin(opts) {
  var self = this;
  self.grid = null;
  self.scope = null;

  self.init = function (scope, grid, services) {

    function doDownloadButton() {
      var fp = angular.element('h1').parent();
      var csvDataLinkPrevious = angular.element('#csv-data-link');
      if (csvDataLinkPrevious != null) {
        csvDataLinkPrevious.remove();
      }
      var csvDataLinkHtml = "<button id=\"csv-data-link\" class=\"btn\"><a href=\"data:text/csv;charset=UTF-8,";
      csvDataLinkHtml += encodeURIComponent(self.prepareCSV());
      csvDataLinkHtml += "\" download=\"Export.csv\">CSV Export</button>";
      fp.append(csvDataLinkHtml);
    }

    self.grid = grid;
    self.scope = scope;

    if (!opts.inhibitButton) {
      setTimeout(doDownloadButton, 0);
      scope.catHashKeys = function () {
        var hash = '';
        for (var idx in scope.renderedRows) {
          hash += scope.renderedRows[idx].$$hashKey;
        }
        return hash;
      };
      scope.$watch('catHashKeys()', doDownloadButton);
    }
  };

  self.createCSV = function () {
    window.open('data:text/csv;charset=UTF-8,' + encodeURIComponent(self.prepareCSV()));
  };

  self.prepareCSV = function () {

    function csvStringify(str) {
      if (str == null) { // we want to catch anything null-ish, hence just == not ===
        return '';
      }
      if (typeof(str) === 'number') {
        return '' + str;
      }
      if (typeof(str) === 'boolean') {
        return (str ? 'TRUE' : 'FALSE');
      }
      if (typeof(str) === 'string') {
        return str.replace(/"/g, '""');
      }

      return JSON.stringify(str).replace(/"/g, '""');
    }

    function swapLastCommaForNewline(str) {
      var newStr = str.substr(0, str.length - 1);
      return newStr + "\n";
    }

    var csvData = '';
    angular.forEach(self.scope.columns, function (col) {
      if (col.visible && (col.width === undefined || col.width > 0)) {
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

'use strict';
/*
 An early version of this was submitted as a PR to the nggrid project.  This version depends on jspdf having footers
 (which was also submitted as a PR to that project).  If jspdf PR is accepted then we can submit this to nggrid again,
 but that would require putting the totals (ngGridTotalCell.js) into a plugin.
 */

function ngGridPdfExportPlugin(options) {
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
      if (pdfDataLinkPrevious != null) {
        pdfDataLinkPrevious.remove();
      }
      var pdfDataLinkHtml = '<button class="pdf-data-link-span">PDF Export</button>';
      fp.append(pdfDataLinkHtml);
      fp.on('click', function () {
        self.createPDF();
      });
    }
  };

  self.createPDF = function () {
    var headers = [],
      data = [],
      footers = {},
      gridWidth = self.scope.totalRowWidth(),
      margin = 15;  // mm defined as unit when setting up jsPDF

    angular.forEach(self.scope.columns, function (col) {
      if (col.visible && (col.width === undefined || col.width > 0)) {
        headers.push({name: col.field, prompt: col.displayName, width: col.width * (185 / gridWidth), align: (col.colDef.align || 'left')});
        if (col.colDef.totalsRow) {
          footers[col.field] = self.scope.getTotalVal(col.field, col.filter).toString();
        }
      }
    });

    angular.forEach(self.grid.filteredRows, function (row) {
      data.push(angular.copy(row.entity));
    });

    var doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFontStyle('bold');
    doc.setFontSize(24);
    doc.text(self.scope.reportSchema.title, margin, margin);
    doc.setFontStyle('normal');
    doc.setFontSize(12);
    doc.cellInitialize();
    doc.table(margin, 24, data, {headers: headers, footers: footers, printHeaders: true, autoSize: false, margins: {left: margin, top: margin, bottom: margin, width: doc.internal.pageSize - margin}});
    doc.output('dataurlnewwindow');
  };
}

/** ====================================================================
 * jsPDF Cell plugin
 * Copyright (c) 2013 Youssef Beddad, youssef.beddad@gmail.com
 *               2013 Eduardo Menezes de Morais, eduardo.morais@usp.br
 *               2013 Lee Driscoll, https://github.com/lsdriscoll
 *               2014 Juan Pablo Gaviria, https://github.com/juanpgaviria
 *               2014 James Hall, james@parall.ax
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * ====================================================================
 */

(function (jsPDFAPI) {
  'use strict';
  /*jslint browser:true */
  /*global document: false, jsPDF */

  var fontName,
    fontSize,
    fontStyle,
    padding = 3,
    margin = 13,
    headerFunction,
    lastCellPos = { x: undefined, y: undefined, w: undefined, h: undefined, ln: undefined },
    pages = 1,
    setLastCellPosition = function (x, y, w, h, ln) {
      lastCellPos = { 'x': x, 'y': y, 'w': w, 'h': h, 'ln': ln };
    },
    getLastCellPosition = function () {
      return lastCellPos;
    };

  jsPDFAPI.setHeaderFunction = function (func) {
    headerFunction = func;
  };

  jsPDFAPI.getTextDimensions = function (txt) {
    fontName = this.internal.getFont().fontName;
    fontSize = this.table_font_size || this.internal.getFontSize();
    fontStyle = this.internal.getFont().fontStyle;
    // 1 pixel = 0.264583 mm and 1 mm = 72/25.4 point
    var px2pt = 0.264583 * 72 / 25.4,
      dimensions,
      text;

    text = document.createElement('font');
    text.id = "jsPDFCell";
    text.style.fontStyle = fontStyle;
    text.style.fontName = fontName;
    text.style.fontSize = fontSize + 'pt';
    text.innerText = txt;

    document.body.appendChild(text);

    dimensions = { w: (text.offsetWidth + 1) * px2pt, h: (text.offsetHeight + 1) * px2pt};

    document.body.removeChild(text);

    return dimensions;
  };

  jsPDFAPI.cellAddPage = function () {
    this.addPage();

    setLastCellPosition(this.margins.left, this.margins.top, undefined, undefined);
    //setLastCellPosition(undefined, undefined, undefined, undefined, undefined);
    pages += 1;
  };

  jsPDFAPI.cellInitialize = function () {
    lastCellPos = { x: undefined, y: undefined, w: undefined, h: undefined, ln: undefined };
    pages = 1;
  };

  jsPDFAPI.cell = function (x, y, w, h, txt, ln, align) {
    var curCell = getLastCellPosition();

    // If this is not the first cell, we must change its position
    if (curCell.ln !== undefined) {
      if (curCell.ln === ln) {
        //Same line
        x = curCell.x + curCell.w;
        y = curCell.y;
      } else {
        //New line
        if ((curCell.y + curCell.h + h + margin) >= this.internal.pageSize.height - this.margins.bottom) {
          this.cellAddPage();
          if (this.printHeaders && this.tableHeaderRow) {
            this.printHeaderRow(ln, true);
          }
        }
        //We ignore the passed y: the lines may have diferent heights
        y = (getLastCellPosition().y + getLastCellPosition().h);

      }
    }

    if (txt[0] !== undefined) {
      if (this.printingHeaderRow) {
        this.rect(x, y, w, h, 'FD');
      } else {
        this.rect(x, y, w, h);
      }
      if (align === 'right') {
        var textSize;
        if (txt instanceof Array) {
          for (var i = 0; i < txt.length; i++) {
            var currentLine = txt[i];
            textSize = this.getStringUnitWidth(currentLine) * this.internal.getFontSize() / (72 / 25.6);
            this.text(currentLine, x + w - textSize - padding, y + this.internal.getLineHeight() * (i + 1));
          }
        } else {
          textSize = this.getStringUnitWidth(txt) * this.internal.getFontSize() / (72 / 25.6);
          this.text(txt, x + w - textSize - padding, y + this.internal.getLineHeight());
        }
      } else {
        this.text(txt, x + padding, y + this.internal.getLineHeight());
      }
    }
    setLastCellPosition(x, y, w, h, ln);
    return this;
  };

  /**
   * Return an array containing all of the owned keys of an Object
   * @type {Function}
   * @return {String[]} of Object keys
   */
  jsPDFAPI.getKeys = (typeof Object.keys === 'function')
    ? function (object) {
    if (!object) {
      return [];
    }
    return Object.keys(object);
  }
    : function (object) {
    var keys = [],
      property;

    for (property in object) {
      if (object.hasOwnProperty(property)) {
        keys.push(property);
      }
    }

    return keys;
  };

  /**
   * Return the maximum value from an array
   * @param array
   * @param comparisonFn
   * @returns {*}
   */
  jsPDFAPI.arrayMax = function (array, comparisonFn) {
    var max = array[0],
      i,
      ln,
      item;

    for (i = 0, ln = array.length; i < ln; i += 1) {
      item = array[i];

      if (comparisonFn) {
        if (comparisonFn(max, item) === -1) {
          max = item;
        }
      } else {
        if (item > max) {
          max = item;
        }
      }
    }

    return max;
  };

  /**
   * Create a table from a set of data.
   * @param {Integer} [x] : left-position for top-left corner of table
   * @param {Integer} [y] top-position for top-left corner of table
   * @param {Object[]} [data] As array of objects containing key-value pairs corresponding to a row of data.
   * @param {Object} [config.headers] String[] Omit or null to auto-generate headers at a performance cost
   * @param {Object} [config.footers] Object containing key-value pairs.  Omit or null if not required
   * @param {Object} [config.printHeaders] True to print column headers at the top of every page
   * @param {Object} [config.autoSize] True to dynamically set the column widths to match the widest cell value
   * @param {Object} [config.margins] margin values for left, top, bottom, and width
   * @param {Object} [config.fontSize] Integer fontSize to use (optional)
   */

  jsPDFAPI.table = function (x, y, data, config) {
    if (!data) {
      throw 'No data for PDF table';
    }

    var headerNames = [],
      headerPrompts = [],
      header,
      i,
      ln,
      cln,
      columnMatrix = {},
      columnWidths = {},
      columnData,
      column,
      columnMinWidths = [],
      columnAligns = [],
      j,
      tableHeaderConfigs = [],
      model,
      jln,
      func,

    //set up defaults. If a value is provided in config, defaults will be overwritten:
      autoSize = false,
      printHeaders = true,
      fontSize = 12,
      headers = null,
      footers = null,
      margins = {left: 0, top: 0, bottom: 0, width: this.internal.pageSize.width};

    if (config) {
      //override config defaults if the user has specified non-default behavior:
      if (config.autoSize === true) {
        autoSize = true;
      }
      if (config.printHeaders === false) {
        printHeaders = false;
      }
      if (config.fontSize) {
        fontSize = config.fontSize;
      }
      if (config.margins) {
        margins = config.margins;
      }
      if (config.headers) {
        headers = config.headers;
      }
      if (config.footers) {
        footers = config.footers;
      }
    }

    /**
     * @property {Number} lnMod
     * Keep track of the current line number modifier used when creating cells
     */
    this.lnMod = 0;
    lastCellPos = { x: undefined, y: undefined, w: undefined, h: undefined, ln: undefined },
      pages = 1;

    this.printHeaders = printHeaders;
    this.margins = margins;
    this.setFontSize(fontSize);
    this.table_font_size = fontSize;

    // Set header values
    if (headers === undefined || (headers === null)) {
      // No headers defined so we derive from data
      headerNames = this.getKeys(data[0]);

    } else if (headers[0] && (typeof headers[0] !== 'string')) {
//            var px2pt = 0.264583 * 72 / 25.4;
      var constant = 1.5; // arrived at by trial and error

      // Split header configs into names and prompts
      for (i = 0, ln = headers.length; i < ln; i += 1) {
        header = headers[i];
        headerNames.push(header.name);
        headerPrompts.push(header.prompt);
        columnWidths[header.name] = header.width * constant;
        columnAligns[header.name] = header.align;
      }

    } else {
      headerNames = headers;
    }
    if (autoSize) {
      // Create a matrix of columns e.g., {column_title: [row1_Record, row2_Record]}
      func = function (rec) {
        return rec[header];
      };

      for (i = 0, ln = headerNames.length; i < ln; i += 1) {
        header = headerNames[i];

        columnMatrix[header] = data.map(
          func
        );

        // get header width
        columnMinWidths.push(this.getTextDimensions(headerPrompts[i] || header).w);
        column = columnMatrix[header];

        // get cell widths
        for (j = 0, cln = column.length; j < cln; j += 1) {
          columnData = column[j];
          columnMinWidths.push(this.getTextDimensions(columnData).w);
        }

        // get footer width
        if (footers) {
          columnMinWidths.push(this.getTextDimensions(footers[i]).w);
        }

        // get final column width
        columnWidths[header] = jsPDFAPI.arrayMax(columnMinWidths);
      }
    }

    // -- Construct the table

    if (printHeaders) {
      var lineHeight = this.calculateLineHeight(headerNames, columnWidths, headerPrompts.length ? headerPrompts : headerNames);

      // Construct the header row
      for (i = 0, ln = headerNames.length; i < ln; i += 1) {
        header = headerNames[i];
        tableHeaderConfigs.push([x, y, columnWidths[header], lineHeight, String(headerPrompts.length ? headerPrompts[i] : header), 0, columnAligns[header]]);
      }

      // Store the table header config
      this.setTableHeaderRow(tableHeaderConfigs);

      // Print the header for the start of the table
      this.printHeaderRow(1, false);
    }

    // Construct the data rows
    for (i = 0, ln = data.length; i < ln; i += 1) {
      var lineHeight;
      model = data[i];
      lineHeight = this.calculateLineHeight(headerNames, columnWidths, model);

      for (j = 0, jln = headerNames.length; j < jln; j += 1) {
        header = headerNames[j];
        this.cell(x, y, columnWidths[header], lineHeight, model[header], i + 2, columnAligns[header]);
      }
    }

    if (footers) {
      // Construct the header row
      for (var fi = 0; fi < headerNames.length; fi++) {
        header = headerNames[fi];
        tableHeaderConfigs[fi][4] = footers[header] || ' ';
      }

      // Print the header for the start of the table
      this.printHeaderRow(i + 2, false);
    }
    this.table_x = x;
    this.table_y = y;
    return this;
  };
  /**
   * Calculate the height for containing the highest column
   * @param {String[]} headerNames is the header, used as keys to the data
   * @param {Integer[]} columnWidths is size of each column
   * @param {Object[]} model is the line of data we want to calculate the height of
   */
  jsPDFAPI.calculateLineHeight = function (headerNames, columnWidths, model) {
    var header, lineHeight = 0;
    for (var j = 0; j < headerNames.length; j++) {
      header = headerNames[j];
      model[header] = this.splitTextToSize(String(model[header]), columnWidths[header] - padding);
      var h = this.internal.getLineHeight() * model[header].length + padding;
      if (h > lineHeight)
        lineHeight = h;
    }
    return lineHeight;
  };

  /**
   * Store the config for outputting a table header
   * @param {Object[]} config
   * An array of cell configs that would define a header row: Each config matches the config used by jsPDFAPI.cell
   * except the ln parameter is excluded
   */
  jsPDFAPI.setTableHeaderRow = function (config) {
    this.tableHeaderRow = config;
  };

  /**
   * Output the store header row
   * @param lineNumber The line number to output the header at
   */
  jsPDFAPI.printHeaderRow = function (lineNumber, new_page) {
    if (!this.tableHeaderRow) {
      throw 'Property tableHeaderRow does not exist.';
    }

    var tableHeaderCell,
      tmpArray,
      i,
      ln;

    this.printingHeaderRow = true;
    if (headerFunction !== undefined) {
      var position = headerFunction(this, pages);
      setLastCellPosition(position[0], position[1], position[2], position[3], -1);
    }
    this.setFontStyle('bold');
    var tempHeaderConf = [];
    for (i = 0, ln = this.tableHeaderRow.length; i < ln; i += 1) {
      this.setFillColor(200, 200, 200);

      tableHeaderCell = this.tableHeaderRow[i];
      if (new_page) {
        tableHeaderCell[1] = this.margins.top;
        tempHeaderConf.push(tableHeaderCell);
      }
      tmpArray = [].concat(tableHeaderCell);
      tmpArray[5] = lineNumber;
      this.cell.apply(this, tmpArray);
    }
    if (tempHeaderConf.length > 0) {
      this.setTableHeaderRow(tempHeaderConf);
    }
    this.setFontStyle('normal');
    this.printingHeaderRow = false;
  };

})(jsPDF.API);

angular.module('formsAngular').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('template/form-button-bs2.html',
    "<div class=\"btn-group pull-right\"><button id=saveButton class=\"btn btn-mini btn-primary form-btn\" ng-click=save() ng-disabled=isSaveDisabled()><i class=icon-ok></i> Save</button> <button id=cancelButton class=\"btn btn-mini btn-warning form-btn\" ng-click=cancel() ng-disabled=isCancelDisabled()><i class=icon-remove></i> Cancel</button></div><div class=\"btn-group pull-right\"><button id=newButton class=\"btn btn-mini btn-success form-btn\" ng-click=new() ng-disabled=isNewDisabled()><i class=icon-plus></i> New</button> <button id=deleteButton class=\"btn btn-mini btn-danger form-btn\" ng-click=delete() ng-disabled=isDeleteDisabled()><i class=icon-minus></i> Delete</button></div>"
  );


  $templateCache.put('template/form-button-bs3.html',
    "<div class=\"btn-group pull-right\"><button id=saveButton class=\"btn btn-primary form-btn btn-xs\" ng-click=save() ng-disabled=isSaveDisabled()><i class=\"glyphicon glyphicon-ok\"></i> Save</button> <button id=cancelButton class=\"btn btn-warning form-btn btn-xs\" ng-click=cancel() ng-disabled=isCancelDisabled()><i class=\"glyphicon glyphicon-remove\"></i> Cancel</button></div><div class=\"btn-group pull-right\"><button id=newButton class=\"btn btn-success form-btn btn-xs\" ng-click=new() ng-disabled=isNewDisabled()><i class=\"glyphicon glyphicon-plus\"></i> New</button> <button id=deleteButton class=\"btn btn-danger form-btn btn-xs\" ng-click=delete() ng-disabled=isDeleteDisabled()><i class=\"glyphicon glyphicon-minus\"></i> Delete</button></div>"
  );


  $templateCache.put('template/search-bs2.html',
    "<form class=\"navbar-search pull-right\"><div id=search-cg class=control-group ng-class=errorClass><input id=searchinput ng-model=searchTarget class=search-query placeholder=\"Ctrl+Slash to Search\" ng-keyup=handleKey($event)></div></form><div class=results-container ng-show=\"results.length >= 1\"><div class=search-results><div ng-repeat=\"result in results\"><span ng-class=resultClass($index) ng-click=selectResult($index)>{{result.resourceText}} {{result.text}}</span></div><div ng-show=\"moreCount > 0\">(plus more - continue typing to narrow down search...)</div></div></div>"
  );


  $templateCache.put('template/search-bs3.html',
    "<form class=\"pull-right navbar-form\"><div id=search-cg class=form-group ng-class=errorClass><input id=searchinput ng-model=searchTarget class=\"search-query form-control\" placeholder=\"Ctrl+Slash to Search\" ng-keyup=handleKey($event)></div></form><div class=results-container ng-show=\"results.length >= 1\"><div class=search-results><div ng-repeat=\"result in results\"><span ng-class=resultClass($index) ng-click=selectResult($index)>{{result.resourceText}} {{result.text}}</span></div><div ng-show=\"moreCount > 0\">(plus more - continue typing to narrow down search...)</div></div></div>"
  );

}]);
