import React, { PureComponent as Component } from 'react';
import {
  Upload,
  Icon,
  message,
  Select,
  Tooltip,
  Button,
  Spin,
  Switch,
  Modal,
  Radio,
  Input,
  Checkbox
} from 'antd';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import './ProjectData.scss';
import axios from 'axios';

import URL from 'url';

const Dragger = Upload.Dragger;
import { saveImportData, fetchInterfaceListMenu } from '../../../../reducer/modules/interface';
import { fetchUpdateLogData } from '../../../../reducer/modules/news.js';
import { handleSwaggerUrlData } from '../../../../reducer/modules/project';
const Option = Select.Option;
const confirm = Modal.confirm;
const plugin = require('client/plugin.js');
const RadioGroup = Radio.Group;
const importDataModule = {};
const exportDataModule = {};
const HandleImportData = require('common/HandleImportData');
function handleExportRouteParams(url, status, isWiki) {
  if (!url) {
    return;
  }
  let urlObj = URL.parse(url, true),
    query = {};
  query = Object.assign(query, urlObj.query, { status, isWiki });
  return URL.format({
    pathname: urlObj.pathname,
    query
  });
}

// exportDataModule.pdf = {
//   name: 'Pdf',
//   route: '/api/interface/download_crx',
//   desc: '导出项目接口文档为 pdf 文件'
// }
@connect(
  state => {
    return {
      curCatid: -(-state.inter.curdata.catid),
      basePath: state.project.currProject.basepath,
      updateLogList: state.news.updateLogList,
      swaggerUrlData: state.project.swaggerUrlData
    };
  },
  {
    saveImportData,
    fetchUpdateLogData,
    handleSwaggerUrlData,
    fetchInterfaceListMenu
  }
)
class ProjectData extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectCatid: '',
      menuList: [],
      curImportType: 'swagger',
      curExportType: null,
      showLoading: false,
      showRapLoading: false,
      dataSync: 'good',
      exportContent: 'all',
      isSwaggerUrl: false,
      swaggerUrl: '',
      rapProjectId: '',
      isWiki: false
    };
  }
  static propTypes = {
    match: PropTypes.object,
    curCatid: PropTypes.number,
    basePath: PropTypes.string,
    saveImportData: PropTypes.func,
    fetchUpdateLogData: PropTypes.func,
    updateLogList: PropTypes.array,
    handleSwaggerUrlData: PropTypes.func,
    swaggerUrlData: PropTypes.string,
    rapProjectId: PropTypes.string,
    fetchInterfaceListMenu: PropTypes.func
  };

  UNSAFE_componentWillMount() {
    axios.get(`/api/interface/getCatMenu?project_id=${this.props.match.params.id}`).then(data => {
      if (data.data.errcode === 0) {
        let menuList = data.data.data;
        this.setState({
          menuList: menuList,
          selectCatid: menuList[0]._id
        });
      }
    });
    plugin.emitHook('import_data', importDataModule);
    plugin.emitHook('export_data', exportDataModule, this.props.match.params.id);
  }

  selectChange(value) {
    this.setState({
      selectCatid: +value
    });
  }

  uploadChange = info => {
    const status = info.file.status;
    if (status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (status === 'done') {
      message.success(`${info.file.name} 文件上传成功`);
    } else if (status === 'error') {
      message.error(`${info.file.name} 文件上传失败`);
    }
  };

  handleAddInterface = async res => {
    return await HandleImportData(
      res,
      this.props.match.params.id,
      this.state.selectCatid,
      this.state.menuList,
      this.props.basePath,
      this.state.dataSync,
      message.error,
      message.success,
      () => this.setState({ showLoading: false })
    );
  };

  // 本地文件上传
  handleFile = info => {
    if (!this.state.curImportType) {
      return message.error('请选择导入数据的方式');
    }
    if (this.state.selectCatid) {
      this.setState({ showLoading: true });
      let reader = new FileReader();
      reader.readAsText(info.file);
      reader.onload = async res => {
        res = await importDataModule[this.state.curImportType].run(res.target.result);
        if (this.state.dataSync === 'merge') {
          // 开启同步
          this.showConfirm(res);
        } else {
          // 未开启同步
          await this.handleAddInterface(res);
        }
      };
    } else {
      message.error('请选择上传的默认分类');
    }
  };

  showConfirm = async res => {
    let that = this;
    let typeid = this.props.match.params.id;
    let apiCollections = res.apis.map(item => {
      return {
        method: item.method,
        path: item.path
      };
    });
    let result = await this.props.fetchUpdateLogData({
      type: 'project',
      typeid,
      apis: apiCollections
    });
    let domainData = result.payload.data.data;
    const ref = confirm({
      title: '您确认要进行数据同步????',
      width: 600,
      okType: 'danger',
      iconType: 'exclamation-circle',
      className: 'dataImport-confirm',
      okText: '确认',
      cancelText: '取消',
      content: (
        <div className="postman-dataImport-modal">
          <div className="postman-dataImport-modal-content">
            {domainData.map((item, index) => {
              return (
                <div key={index} className="postman-dataImport-show-diff">
                  <span className="logcontent" dangerouslySetInnerHTML={{ __html: item.content }} />
                </div>
              );
            })}
          </div>
          <p className="info">温馨提示： 数据同步后，可能会造成原本的修改数据丢失</p>
        </div>
      ),
      async onOk() {
        await that.handleAddInterface(res);
      },
      onCancel() {
        that.setState({ showLoading: false, dataSync: 'normal' });
        ref.destroy();
      }
    });
  };

  handleImportType = val => {
    this.setState({
      curImportType: val,
      isSwaggerUrl: false
    });
  };

  handleExportType = val => {
    this.setState({
      curExportType: val,
      isWiki: false
    });
  };

  // 处理导入信息同步
  onChange = checked => {
    this.setState({
      dataSync: checked
    });
  };

  // 处理swagger URL 导入
  handleUrlChange = checked => {
    this.setState({
      isSwaggerUrl: checked
    });
  };

  // 记录输入的url
  swaggerUrlInput = url => {
    this.setState({
      swaggerUrl: url
    });
  };

  // 记录rap项目ID
  rapProjectInput = id => {
    this.setState({
      rapProjectId: id
    });
  };

  // url导入上传
  onUrlUpload = async () => {
    if (!this.state.curImportType) {
      return message.error('请选择导入数据的方式');
    }

    if (!this.state.swaggerUrl) {
      return message.error('url 不能为空');
    }
    if (this.state.selectCatid) {
      this.setState({ showLoading: true });
      try {
        // 处理swagger url 导入
        await this.props.handleSwaggerUrlData(this.state.swaggerUrl);
        // let result = json5_parse(this.props.swaggerUrlData)
        let res = await importDataModule[this.state.curImportType].run(this.props.swaggerUrlData);
        if (this.state.dataSync === 'merge') {
          // merge
          this.showConfirm(res);
        } else {
          // 未开启同步
          await this.handleAddInterface(res);
        }
      } catch (e) {
        this.setState({ showLoading: false });
        message.error(e.message);
      }
    } else {
      message.error('请选择上传的默认分类');
    }
  };

  // 处理导出接口是全部还是公开
  handleChange = e => {
    this.setState({ exportContent: e.target.value });
  };

  //  处理是否开启wiki导出
  handleWikiChange = e => {
    this.setState({
      isWiki: e.target.checked
    });
  };

  formatDeep(key) {
    let res_body = {
      properties: {},
      required: [],
      title: "empty object",
      type: "object"
    }
    key.forEach(rp => {
      let identifier =rp.identifier.split('|')[0]
      res_body.required.push(identifier)
      let len = rp.identifier.split('|')[1]
      // rp.dataType.match(/array<(.*)>/
      if(rp.dataType.match(/array<(.*)>/)) {
        let type = rp.dataType.match(/array<(.*)>/)[1]
        if(type == 'object'){
          len = len || '1'
          res_body.properties[identifier]={
            items: this.formatDeep(rp.parameterList),
            maxItems: len.split('-')[0],
            minItems: len.split('-')[1] || len.split('-')[0],
            type: "array"
          }
        } else {
          let arr = rp.remark ? JSON.parse(rp.remark.replace('@mock=','')) : rp.remark.indexOf('$order') > -1 ? rp.remark.split('$order')[1].replace(/[()\'\"]/g,'').split(',') : []
          res_body.properties[identifier]={
            items: {
              mock:{
                mock: type=='number' ? '@integer' : ('@'+type)
              },
              type
            },
            type: 'array',
            maxItems: arr.length || 1,
            minItems: arr.length || 1
          }
        }
        
      } else {
        let mock = rp.remark ? rp.remark.replace('@mock=','').replace(/[\'\"]/g,'') : ''
        let arr = mock && mock.indexOf('$order') > -1 ? mock.split('$order')[1].replace(/[()\'\"]/g,'').split(',') : []

        let ps = {
          description: rp.name,
          mock: mock ? {
            mock
          } : undefined,
          type: rp.dataType,
          minLength: len ? len.split('-')[0] : undefined,
          maxLength: len ? (len.split('-')[1] ? len.split('-')[1] : len.split('-')[0]) : undefined
        }
        if(arr.length > 0){
          delete ps.mock
          delete ps.description
          ps.enum = arr
        }
        if(rp.parameterList.length === 0){
          res_body.properties[identifier] = ps
        } else {
          res_body.properties[identifier] = this.formatDeep(rp.parameterList)
        }
      }
    })
    return res_body
  }

  addInterface(pageList, catid){
    pageList.forEach(j=>{
      let fName = j.name && j.name!=='某页面' ? `[${j.name}] - ` : ''
      j.actionList.forEach( t => {
        if(t.requestUrl){
          let rm = t.requestType === '1' ? 'GET' : t.requestType === '2' ? 'POST' : t.requestType === '3' ? 'PUT' : 'DELETE'
          let createParams = {
            catid,
            method: rm,
            path: t.requestUrl[0]=='/' ? t.requestUrl : `/${t.requestUrl}`,
            project_id: this.props.match.params.id,
            title: `${fName}${t.name}`
          }
          axios.post('/api/interface/add',createParams).then(res3 => {
            if(res3.data.errcode !== 0){
              message.error(`插入${fName}${t.name}失败: ${res3.data.errmsg}`);
              console.error(`插入${fName}${t.name}失败: ${res3.data.errmsg}`);
              return false
            }
            if(rm != 'GET' && rm != 'POST'){
              console.warn(`【${rm}】请求方式导入可能有问题`);
            }
            let interface_id = res3.data.data._id
            let req_query = []
            let req_body_other = {
              properties: {},
              required: [],
              title: "empty object",
              type: "object"
            }
            if(rm === 'GET') {
              t.requestParameterList.forEach( rp => {
                req_query.push({
                  desc: rp.name,
                  example: rp.remark.replace('@mock=','').replace(/[\'\"]/g,''),
                  name: rp.identifier,
                  required: "1"
                })
              })
            } else {
              t.requestParameterList.forEach(rp => {
                req_body_other.required.push(rp.identifier)
                req_body_other.properties[rp.identifier] = {
                  description: rp.name,
                  mock: rp.remark ? {
                    mock: rp.remark.replace('@mock=','').replace(/[\'\"]/g,'')
                  } : undefined,
                  type: rp.dataType
                }
              })
            }

            let res_body = this.formatDeep(t.responseParameterList)

            let upparams = Object.assign({
              api_opened: false,
              catid: '',
              desc: '',
              id: interface_id,
              markdown: '',
              method: '',
              path: '',
              req_body_form: [],
              req_body_is_json_schema: true,
              req_body_other: rm === 'GET' ? undefined : JSON.stringify(req_body_other),
              req_body_type: rm === 'GET' ? undefined : 'json',
              req_headers: rm === 'GET' ? [] : [{name: "Content-Type", value: "application/json"}],
              req_params: [],
              req_query: rm === 'GET' ? req_query : undefined,
              res_body: JSON.stringify(res_body),
              res_body_is_json_schema: true,
              res_body_type: 'json',
              status: 'done',
              switch_notice: true,
              tag: [],
              title: ''
            }, createParams)
            delete upparams.project_id
            axios.post('/api/interface/up', upparams).then(upres => {
              if(upres.data.errcode === 0){
                message.success(`插入接口${fName}${t.name}成功`);
              } else {
                message.error(`插入接口${fName}${t.name}失败: ${upres.data.errmsg}`)
                console.error(`插入接口${fName}${t.name}失败: ${upres.data.errmsg}`)
              }
            })
          })
        }
      })
    })
  }

  importFromRap = async() => {
    // let r = await this.props.fetchInterfaceListMenu(this.props.match.params.id);
    // console.log(r)
    let project_id = this.props.match.params.id
    const res = await axios.get('/api/interface/rap_json?id='+this.state.rapProjectId+'&project_id='+project_id)
    if(res.data.errcode === 0){
      message.success(`远程获取RAP数据成功`);
      console.log('rap数据=>', res.data.data)
    } else {
      message.error(res.data.errmsg||'[请检查projectID是否存在]')
      return false
    }
 
    res.data.data.moduleList.forEach( e=> {
      let moduleName = (e.name == '' || e.name=='某模块（点击编辑后双击修改）') ? res.data.data.name : e.name
      axios.post('/api/interface/add_cat', {
        desc: moduleName,
        name: moduleName,
        project_id
      }).then(res2 => {
        if(res2.data.errcode === 0){
          message.success(`新增接口分类[${moduleName}]成功`);
          let catid = res2.data.data._id
          this.addInterface(e.pageList, catid)
        } else {
          message.error(res2.data.errmsg)
        }
        
      })
      
    })
  }

  /**
   *
   *
   * @returns
   * @memberof ProjectData
   */
  render() {
    const uploadMess = {
      name: 'interfaceData',
      multiple: true,
      showUploadList: false,
      action: '/api/interface/interUpload',
      customRequest: this.handleFile,
      onChange: this.uploadChange
    };

    let exportUrl =
      this.state.curExportType &&
      exportDataModule[this.state.curExportType] &&
      exportDataModule[this.state.curExportType].route;
    let exportHref = handleExportRouteParams(
      exportUrl,
      this.state.exportContent,
      this.state.isWiki
    );

    // console.log('inter', this.state.exportContent);
    return (
      <div className="g-row">
        <div className="m-panel">
          <div className="postman-dataImport">
            <div className="dataImportCon">
              <div>
                <h3>
                  数据导入&nbsp;
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://yapi.ymfe.org/documents/data.html"
                  >
                    <Tooltip title="点击查看文档">
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </a>
                </h3>
              </div>
              <div className="dataImportTile">
                <Select
                  placeholder="请选择导入数据的方式"
                  value={this.state.curImportType}
                  onChange={this.handleImportType}
                >
                  {Object.keys(importDataModule).map(name => {
                    return (
                      <Option key={name} value={name}>
                        {importDataModule[name].name}
                      </Option>
                    );
                  })}
                </Select>
              </div>
              <div className="catidSelect">
                <Select
                  value={this.state.selectCatid + ''}
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="请选择数据导入的默认分类"
                  optionFilterProp="children"
                  onChange={this.selectChange.bind(this)}
                  filterOption={(input, option) =>
                    option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {this.state.menuList.map((item, key) => {
                    return (
                      <Option key={key} value={item._id + ''}>
                        {item.name}
                      </Option>
                    );
                  })}
                </Select>
              </div>
              <div className="dataSync">
                <span className="label">
                  数据同步&nbsp;
                  <Tooltip
                    title={
                      <div>
                        <h3 style={{ color: 'white' }}>普通模式</h3>
                        <p>不导入已存在的接口</p>
                        <br />
                        <h3 style={{ color: 'white' }}>智能合并</h3>
                        <p>
                          已存在的接口，将合并返回数据的 response，适用于导入了 swagger
                          数据，保留对数据结构的改动
                        </p>
                        <br />
                        <h3 style={{ color: 'white' }}>完全覆盖</h3>
                        <p>不保留旧数据，完全使用新数据，适用于接口定义完全交给后端定义</p>
                      </div>
                    }
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>{' '}
                </span>
                <Select value={this.state.dataSync} onChange={this.onChange}>
                  <Option value="normal">普通模式</Option>
                  <Option value="good">智能合并</Option>
                  <Option value="merge">完全覆盖</Option>
                </Select>

                {/* <Switch checked={this.state.dataSync} onChange={this.onChange} /> */}
              </div>
              {this.state.curImportType === 'swagger' && (
                <div className="dataSync">
                  <span className="label">
                    开启url导入&nbsp;
                    <Tooltip title="swagger url 导入">
                      <Icon type="question-circle-o" />
                    </Tooltip>{' '}
                    &nbsp;&nbsp;
                  </span>

                  <Switch checked={this.state.isSwaggerUrl} onChange={this.handleUrlChange} />
                </div>
              )}
              {this.state.isSwaggerUrl ? (
                <div className="import-content url-import-content">
                  <Input
                    placeholder="http://demo.swagger.io/v2/swagger.json"
                    onChange={e => this.swaggerUrlInput(e.target.value)}
                  />
                  <Button
                    type="primary"
                    className="url-btn"
                    onClick={this.onUrlUpload}
                    loading={this.state.showLoading}
                  >
                    上传
                  </Button>
                </div>
              ) : (
                <div className="import-content">
                  <Spin spinning={this.state.showLoading} tip="上传中...">
                    <Dragger {...uploadMess}>
                      <p className="ant-upload-drag-icon">
                        <Icon type="inbox" />
                      </p>
                      <p className="ant-upload-text">点击或者拖拽文件到上传区域</p>
                      <p
                        className="ant-upload-hint"
                        onClick={e => {
                          e.stopPropagation();
                        }}
                        dangerouslySetInnerHTML={{
                          __html: this.state.curImportType
                            ? importDataModule[this.state.curImportType].desc
                            : null
                        }}
                      />
                    </Dragger>
                  </Spin>
                </div>
              )}
            </div>

            <div
              className="dataImportCon"
              style={{
                marginLeft: '20px',
                display: Object.keys(exportDataModule).length > 0 ? '' : 'none'
              }}
            >
              <div>
                <h3>数据导出</h3>
              </div>
              <div className="dataImportTile">
                <Select placeholder="请选择导出数据的方式" onChange={this.handleExportType}>
                  {Object.keys(exportDataModule).map(name => {
                    return (
                      <Option key={name} value={name}>
                        {exportDataModule[name].name}
                      </Option>
                    );
                  })}
                </Select>
              </div>

              <div className="dataExport">
                <RadioGroup defaultValue="all" onChange={this.handleChange}>
                  <Radio value="all">全部接口</Radio>
                  <Radio value="open">公开接口</Radio>
                </RadioGroup>
              </div>
              <div className="export-content">
                {this.state.curExportType ? (
                  <div>
                    <p className="export-desc">{exportDataModule[this.state.curExportType].desc}</p>
                    <a 
                      target="_blank"
                      rel="noopener noreferrer"
                      href={exportHref}>
                      <Button className="export-button" type="primary" size="large">
                        {' '}
                        导出{' '}
                      </Button>
                    </a>
                    <Checkbox
                      checked={this.state.isWiki}
                      onChange={this.handleWikiChange}
                      className="wiki-btn"
                      disabled={this.state.curExportType === 'json'}
                    >
                      添加wiki&nbsp;
                      <Tooltip title="开启后 html 和 markdown 数据导出会带上wiki数据">
                        <Icon type="question-circle-o" />
                      </Tooltip>{' '}
                    </Checkbox>
                  </div>
                ) : (
                  <Button disabled className="export-button" type="primary" size="large">
                    {' '}
                    导出{' '}
                  </Button>
                )}
              </div>
            </div>

            <div
              className="dataImportCon"
              style={{
                marginLeft: '20px',
                display: Object.keys(exportDataModule).length > 0 ? '' : 'none'
              }}
            >
              <div>
                <h3>
                  RAP项目导入&nbsp;
                  <Tooltip title={
                    <div>
                      <h3 style={{ color: 'white' }}>Project Id</h3>
                      <p>在RAP中点入项目之后，查看浏览器地址栏中的“projectId=”</p>
                      <br />
                      <h3 style={{ color: 'white' }}>导入的文件夹</h3>
                      <p>
                        导入之后以接口的模块建立文件夹，即RAP进入项目后内容区域右上角的Tab
                      </p>
                      <br />
                      <h3 style={{ color: 'white' }}>接口名称前缀</h3>
                      <p>如果RAP项目中接口列表有分多个group，则在接口名称前面添加group名称</p>
                    </div>
                    }
                    >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </h3>
              </div>
              <div className="dataImportTile">
                <Input
                    placeholder="Rap Project Id"
                    onChange={e => this.rapProjectInput(e.target.value)}
                  />
                <div className="export-content" style={{paddingTop: '20px'}}>
                  <Button
                    type="primary"
                    className="url-btn"
                    onClick={this.importFromRap}
                    disabled={this.state.rapProjectId == ''}
                    loading={this.state.showRapLoading}
                  >
                    导入
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ProjectData;
