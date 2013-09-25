//公用方法
var MT = {
	//触发点击
	doClick: function(el){
		var e = document.createEvent('MouseEvent');   
		e.initEvent('click', true, true);  
		el.dispatchEvent(e);
	},
	
	//获取帐号
	getAccount: function(type){
		var store = localStorage.getItem('mt_auto_publish_account') || '{}';
		var account = JSON.parse(store);

		return account[type] || {};
	}
};

var diandian = (function(){
	var Diandian = function(){
		this.cache = {
			title: $.trim($('h1').html()),
			element: $('#share li'),
			desc: $('.det-cont').html()
		}
	}
	Diandian.prototype = {
		render: function(){
			var self = this;
			var images = [];
			var element = self.cache.element;

			element.each(function(i){
				var path = $(this).find('img').attr('src');
				
				if(path.indexOf('blank.gif') > -1){
					path = $(this).find('img').data('src');
				}

				//最多只允许20张图片
				if(i < 20){
					images.push('src['+ i +']='+ self.switchCover(path));
				}
			});

			self.openTab({
				title: self.cache.title,
				desc: self.cache.desc,
				images: images
			});
		},


		openTab: function(data){
			//console.log(data);
			chrome.extension.sendRequest(data, function(response) {
				//console.log(response);
			});
		},

		/* 切换小图到封面 */
		switchCover: function(image){
			if(image.indexOf('.jpg!') > -1){
				return image.replace('!240', '!650');
			}else{
				return image.replace('_240x999.jpg', '_650x999.jpg');
			}
		}
	};

	return new Diandian();
})();

var weibo = (function(){
	var Weibo = function(){
		this.cache = {
			timer: null,
			user: '',
			pwd: ''
		}
	};
	Weibo.prototype = {
		isReady: function(callback){
			var cache = this.cache;
			var snAccount = null;

			//获取帐号数据
			chrome.extension.sendRequest({
				type: 'account',
				action: 'get'
			}, function(account){
				if(account['sina']){
					snAccount = account['sina'];

					if(snAccount['username'] && snAccount['password']){
						cache.user = snAccount['username'];
						cache.pwd = snAccount['password'];
					}

					callback(true);
				}else{
					callback(false);
				}
			});

			return this;
		},

		render: function(){
			var cache = this.cache;
			var title = $('title').html();
			var ralateUid = '';
			var pic = $('#ds-wb .bdshare_t').eq(0).attr('data');
			var link = [];

			//获取数据
			$('script').each(function(){
				var html = $(this).html();
				if(html.indexOf('bds_config') > -1){
					var text = html.match(/bdText\:\'([^\']*)'/gi);
					var relate = html.match(/wbUid\:\'([^\']*)'/gi);

					if(text.length > 0){
						title = text[0].replace('bdText:\'', '').replace('\'', '');
					}

					if(relate.length > 0){
						ralateUid = text[0].replace('wbUid:\'', '').replace('\'', '');
					}
				}
			});

			link = [
				'http://service.weibo.com/share/share.php?', 
				'url=', encodeURIComponent(window.location.href),
				'&title=', encodeURIComponent(title),
				'&appkey=2838777972',
				'&pic=', encodeURIComponent(pic.replace('{\'pic\':\'', '').replace('\'}', '')),
				'&ralateUid='+ ralateUid
			];

			//通知后台在新tab中打开页面
			chrome.extension.sendRequest({
				type: 'sina',
				action: 'opentab',
				url: link.join('')
			}, function(response){
				//保存打开的tab
				//console.log(response);
				//cache.tab = response;
			});
		},

		publish: function(){
			var self = this;
			var cache = this.cache;

			if($('#pl_share_login a').eq(0).attr('action-type') == 'login'){
				//console.log('未登录');
				self.login();
			}else{
				//判断是否发布成功
				if($('#pl_share_success').size() > 0){
					//console.log('发布成功');
					//通知后台关闭tab
					chrome.extension.sendRequest({
						type: 'sina',
						action: 'closetab',
						tab: cache.tab
					});
				}else{
					console.log('开始发布');

					self.selectPic();
					//点击发布
					MT.doClick($('#shareIt').get(0));

					//判断发布状态
					cache.timer = setTimeout(function(){
						self.checkState();
					}, 5000);
				}
			}
		},

		//依次选择9张图片
		selectPic: function(){
			//展开全部图片
			$('.weibo_img').click();
			
			$('.layer_plain_container').find('img').each(function(i){
				if(i > 0 && i < 9){
					$(this).click();
				}
			});

			$('.layer_close_btn').click();
		},

		//轮询判断发布状态
		checkState: function(){
			var self = this;
			var cache = this.cache;
			var process = $('.progress_note')
			var target = $('.layer_mask_exhibit .result_note')
			var msg = target.html();

			//console.log('发布ing');

			if(process.size() > 0 || target.size() > 0){
				var retryEl = target.find('a').eq(0);

				if(msg && msg.indexOf('重试') > -1){
					//console.log('重试');
					MT.doClick(retryEl.get(0));
				}

				cache.timer = setTimeout(function(){
					self.checkState();
				}, 3000);
			}
		},

		//自动登录
		login: function(){
			var cache = this.cache;

			$('.WB_dialog .WB_iptxt').each(function(){
				if($(this).attr('type') == 'text'){
					$(this).val(cache.user);
				}
				if($(this).attr('type') == 'password'){
					$(this).val(cache.pwd);
				}
			});

			$('.WB_dialog .WB_btnA span').click();
		}
	};

	return new Weibo();
})();


(function(){
	var location = window.location.href;

	//打开detail自动分享到微博
	if(document.domain.indexOf('lovewith.me') > -1 && location.match(/lovewith\.me(\:\d+)?\/share\/detail\/all\/\d+#auto_publish/gi)){
	//if(document.domain.indexOf('lovewith.me') > -1 && location.indexOf('share/detail/all/') > -1){
		//console.log('自动发布');
		weibo.isReady(function(isReady){
			if(isReady){
				weibo.render();
			}else{
				alert('没有添加微博帐号');
			}
		});
	}

	//新浪微博分享页面自动填充登录数据并提交分享
	if(location.indexOf('service.weibo.com/share/') > -1){
		weibo.publish();
	}
})();