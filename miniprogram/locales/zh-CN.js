module.exports = {
  common: {
    home: '首页',
    my: '我的',
    language: '语言'
  },
  languageOptions: {
    'en-US': 'EN',
    'zh-CN': '中文'
  },
  nav: {
    home: '足球报名',
    createActivity: '创建活动',
    editActivity: '编辑活动',
    activityDetail: '活动详情',
    myActivities: '我的活动',
    adjustCover: '裁剪封面',
    joinActivity: '填写报名',
    joinTeam: '报名 {{teamName}}'
  },
  home: {
    createActivity: '创建活动'
  },
  activityCard: {
    start: '开始时间：{{value}}',
    joinedCapacity: '已报名 {{joined}} / {{total}}'
  },
  activity: {
    status: {
      joinable: '可报名',
      full: '已满',
      signupClosed: '报名已截止',
      cancelled: '已取消',
      deleted: '已删除',
      ended: '已结束',
      joined: '已报名'
    },
    share: {
      publishedTitle: '活动已发布',
      publishedCopy: '现在就可以从活动详情页转发给好友或群聊。',
      defaultTitle: '分享此活动',
      defaultCopy: '使用微信分享把这条报名页发送给你的群聊。',
      action: '分享活动'
    },
    actions: {
      copyParticipantNames: '复制报名名单',
      edit: '编辑活动',
      cancelActivity: '取消活动',
      cancelSignup: '退出报名',
      removeMember: '移除',
      delete: '删除'
    },
    teamList: {
      empty: '暂无报名成员'
    }
  },
  activityCreate: {
    title: '活动标题',
    activityDate: '活动日期',
    activityTime: '活动时间',
    startTime: '开始时间',
    endTime: '结束时间',
    signupDeadline: '报名截止',
    deadlineDate: '截止日期',
    deadlineTime: '截止时间',
    deadlineHint: '报名截止时间必须早于或等于活动开始时间。',
    inviteCode: '邀请码',
    inviteCodePlaceholder: '可选邀请码',
    teams: '分队设置',
    teamsHint: '默认两队，可继续新增第 3 队和第 4 队。',
    totalSignupLimit: '总报名人数',
    totalSignupLimitPlaceholder: '总报名人数',
    namedTeamsSlots: '正式队容量：{{count}} 人',
    benchSlots: '替补容量：{{count}} 人',
    overCapacity: '总报名人数必须覆盖所有正式队容量。',
    description: '活动说明',
    descriptionPlaceholder: '活动说明',
    activityImage: '活动图片',
    imageHint: '当前支持 {{count}} 张图片。上传后会裁剪为首页和详情页共用的 2:1 封面比例，数据模型已预留后续多图扩展。',
    replaceImage: '重新选择图片',
    chooseAndCropImage: '选择并裁剪图片',
    removeImage: '移除图片',
    location: '活动地点',
    addressPlaceholder: '地址',
    selectedPin: '已选定位：{{name}}',
    chooseOnMap: '微信地图选点',
    publish: '发布活动',
    saveChanges: '保存修改'
  },
  activityJoin: {
    title: '报名 {{teamName}}',
    hint: '可以使用微信资料，也可以手动填写报名信息。',
    avatar: '头像',
    avatarPlaceholder: '头像',
    avatarHint: '可选，点击使用或更换微信头像。',
    signupName: '报名名称',
    signupNamePlaceholder: '报名名称',
    phone: '手机号',
    phonePlaceholder: '手机号',
    useWeChatPhone: '用微信手机号',
    phoneHint: '手机号必填。可以授权微信手机号，也可以手动输入。',
    phoneAuthSkipped: '已跳过手机号授权',
    phoneAuthFailed: '无法获取微信手机号',
    confirm: '确认报名',
    success: '报名成功'
  },
  coverCrop: {
    title: '裁剪封面',
    hint: '下方会完整显示原图，高亮的 2:1 取景框就是首页和活动详情页最终展示的封面范围。',
    loading: '正在准备裁剪器...',
    controls: {
      zoom: '缩放',
      panX: '左右构图',
      panY: '上下构图'
    },
    actions: {
      confirm: '使用该封面',
      cancel: '取消'
    }
  },
  my: {
    filterLabel: '筛选',
    tabs: {
      created: '我创建的',
      joined: '我参加的'
    },
    filters: {
      all: '全部',
      published: '进行中',
      cancelled: '已取消',
      deleted: '已删除'
    },
    languageLabel: '语言'
  },
  teamEditor: {
    addTeam: '新增队伍',
    remove: '移除',
    upToTeams: '最多支持 {{count}} 支队伍',
    teamNamePrefix: '队伍',
    whiteTeam: '白队',
    redTeam: '红队'
  },
  modal: {
    cancelActivity: {
      title: '取消活动',
      content: '该操作会停止新的报名，并将活动标记为已取消。'
    },
    deleteActivity: {
      title: '删除活动',
      content: '只有无人报名的活动才可以删除，删除后活动仍会保留在你的历史记录中。'
    },
    removeRegistration: {
      title: '移除成员',
      content: '确认将 {{name}} 从本活动中移除？',
      defaultName: '该成员'
    }
  },
  toast: {
    participantNamesCopied: '已复制报名名单',
    noParticipantsToCopy: '暂无报名成员',
    chooseLocationFailed: '无法选择地点',
    chooseImageFailed: '无法选择图片',
    openImageFailed: '无法打开图片',
    cropImageFailed: '无法裁剪图片',
    loadImageSourceFailed: '无法加载图片来源。',
    loadActivitiesFailed: '无法加载活动列表',
    locationPinUnavailable: '没有可用的地图定位'
  },
  errors: {
    activityTitleRequired: '活动标题不能为空',
    activityAddressRequired: '活动地址不能为空',
    activityStartTimeRequired: '活动开始时间不能为空',
    activityEndTimeRequired: '活动结束时间不能为空',
    signupDeadlineRequired: '报名截止时间不能为空',
    activityEndTimeOrder: '活动结束时间必须晚于开始时间',
    signupDeadlineOrder: '报名截止时间必须早于或等于活动开始时间',
    totalSignupLimitRequired: '请填写总报名人数',
    onlyOneActivityImage: '当前仅支持上传 1 张活动图片',
    atLeastOneTeamRequired: '至少需要 1 支队伍',
    tooManyTeams: '队伍数量超出上限',
    teamNameRequired: '队伍名称不能为空',
    teamCapacityRequired: '每队人数必须大于 0',
    totalSignupLimitCoverTeams: '总报名人数必须覆盖所有队伍人数',
    signupNameRequired: '报名名称不能为空',
    activityNotFound: '活动不存在',
    activityNotOpen: '当前活动不可报名',
    signupClosed: '报名已截止',
    teamNotFound: '队伍不存在',
    activityFull: '活动人数已满',
    teamFull: '该队伍人数已满',
    alreadyJoined: '你已报名该活动',
    noActiveRegistration: '当前没有可取消的报名',
    signupCannotBeCancelled: '当前已不能退出报名',
    removeRegistrationNotAllowed: '只有组织者或管理员可以移除报名成员',
    organizerCancelOnly: '只有组织者可以取消活动',
    organizerDeleteOnly: '只有组织者可以删除活动',
    deleteOnlyEmpty: '只有无人报名的活动才可以删除'
  }
};
