import React from 'react';
import {SafeAreaView, StyleSheet, TouchableOpacity, Text, StatusBar, Platform, AsyncStorage} from 'react-native';
import {XHttp, XHttpConfig, XStorage} from 'react-native-easy-app';
import {RNStorage} from './src/AppStorage';

const baseUrl = 'https://react-native-easy-app.oss-cn-beijing.aliyuncs.com/';

export default class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            data: '',
            initStorage: false,
        };
        this.initConfig();
    }

    render() {
        let {data, initStorage} = this.state;
        return initStorage && <>
            <StatusBar barStyle="dark-content"/>
            <SafeAreaView>
                <Text style={[styles.item, {fontWeight: 'bold', marginBottom: 30, backgroundColor: '#EEE'}]}>当前用户状态：{RNStorage.hasLogin ? '已登录' : '未登录'}</Text>
                {RNStorage.hasLogin ?
                    <TouchableOpacity style={styles.item} onPress={this.logout}>
                        <Text style={{fontWeight: 'bold'}}>退出登录</Text>
                    </TouchableOpacity>
                    :
                    <TouchableOpacity style={styles.item} onPress={this.login}>
                        <Text style={{fontWeight: 'bold'}}>账号密码登录</Text>
                    </TouchableOpacity>
                }
                {RNStorage.hasLogin && <TouchableOpacity style={styles.item} onPress={this.queryUserInfo}>
                    <Text style={{fontWeight: 'bold'}}>获取用户信息</Text>
                </TouchableOpacity>}
                <Text style={styles.content}>{data}</Text>
            </SafeAreaView>
        </>;
    }

    login = () => {
        let params = {userName: 'zhangsan', userPass: '123456a'};
        XHttp().url('api/login').param(params).formEncoded().get((success, json, message, status, resonse) => {
            if (success) {
                if (resonse.headers && resonse.headers.map) {
                    RNStorage.accessToken = resonse.headers.map['x-oss-meta-accesstoken'];
                    RNStorage.refreshToken = resonse.headers.map['x-oss-meta-refreshtoken'];
                }
                RNStorage.customerId = json.customerId;
                RNStorage.hasLogin = true;
                this.setState({data: JSON.stringify(json)});
            } else {
                console.log('失败', message);
            }
        });
    };

    queryUserInfo = () => {
        XHttp().url('api/userInfo').formJson().get((success, json, message) => {
            if (success) {
                RNStorage.userInfo = json;
                this.setState({data: JSON.stringify(json)});
            } else {
                console.log('失败', message);
            }
        });
    };

    logout = () => {
        RNStorage.hasLogin = false;
        RNStorage.customerId = '';
        RNStorage.refreshToken = '';
        RNStorage.accessToken = '';
        this.setState({data: 'User has logout'});
    };


    initConfig = () => {
        XStorage.initStorage(RNStorage, AsyncStorage, () => {
            this.setState({initStorage: true});
            this.initHttpConfig();
        }, data => {
            data.map(([keyStr, value]) => {
                let [, key] = keyStr.split('#');
                console.log(key, '<###>', value);
            });
        });
    };

    initHttpConfig = () => {
        if (!RNStorage.baseUrl) {
            RNStorage.baseUrl = baseUrl;
        }
        XHttpConfig().initHttpLogOn(true)
            .initBaseUrl(RNStorage.baseUrl)
            .initHeaderSetFunc((headers) => {
                headers['model'] = 'xiao mi';
                headers['version'] = '1.0.0';
                headers['platform'] = Platform.OS;
                headers['channelCode'] = 'channelOfficial';
                if (RNStorage.hasLogin) {
                    headers['customerId'] = RNStorage.customerId;
                    headers['accessToken'] = RNStorage.accessToken;
                    headers['refreshToken'] = RNStorage.refreshToken;
                }
            })
            .initParamSetFunc(params => {
                if (RNStorage.hasLogin) {
                    params['customerId'] = RNStorage.customerId;
                }
            })
            .initParseDataFunc((result, request, callback) => {
                let {success, json, message, status, response} = result;
                if (status === 503) {// accessToken过期标记
                    this.refreshToken(request, callback);
                } else {
                    let {data, successful, msg, code} = json;
                    callback(success && successful === 1, data || {}, msg || message, code, response);
                }
            });
    };

    refreshToken = (request, callback) => {
        if (global.hasQueryToken) {
            global.tokenExpiredList.push({request, callback});
        } else {
            global.hasQueryToken = true;
            global.tokenExpiredList = [{request, callback}];
            const refreshUrl = `${RNStorage.baseUrl}api/refreshToken?refreshToken=${RNStorage.refreshToken}`;
            fetch(refreshUrl).then(resp => {
                resp.json().then(({successful, data: {accessToken}}) => {
                    if (successful === 1) {// 获取到新的accessToken
                        RNStorage.accessToken = accessToken;
                        global.tokenExpiredList.map(({request, callback}) => {
                            request.resendRequest(request, callback);
                        });
                        global.tokenExpiredList = [];
                    } else {
                        console.log('Token 过期，退出登录');
                    }
                });
            }).catch(err => {
                console.log('Token 过期，退出登录');
            }).finally(() => {
                global.hasQueryToken = false;
            });
        }
    };

}

const styles = StyleSheet.create({
    item: {
        padding: 16,
        backgroundColor: '#EEE',
        borderBottomColor: '#DDD',
        borderBottomWidth: 1,
    },
    content: {
        fontSize: 13,
        padding: 10,
    },
});
