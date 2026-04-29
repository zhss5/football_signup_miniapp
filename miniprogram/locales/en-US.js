module.exports = {
  common: {
    home: 'Home',
    my: 'My',
    language: 'Language'
  },
  languageOptions: {
    'en-US': 'EN',
    'zh-CN': '中文'
  },
  nav: {
    home: 'Football Signup',
    createActivity: 'Create Activity',
    editActivity: 'Edit Activity',
    activityDetail: 'Activity Detail',
    myActivities: 'My Activities',
    adjustCover: 'Adjust Cover',
    joinActivity: 'Join Activity'
  },
  home: {
    createActivity: 'Create Activity'
  },
  activityCard: {
    start: 'Start: {{value}}',
    joinedCapacity: 'Joined {{joined}} / {{total}}'
  },
  activity: {
    status: {
      joinable: 'Joinable',
      full: 'Full',
      signupClosed: 'Signup Closed',
      cancelled: 'Cancelled',
      deleted: 'Deleted',
      ended: 'Ended',
      joined: 'Joined'
    },
    share: {
      publishedTitle: 'Activity published',
      publishedCopy: 'Invite players right away from the activity detail page.',
      defaultTitle: 'Share this activity',
      defaultCopy: 'Use WeChat share to send this signup page to your group.',
      action: 'Share Activity'
    },
    actions: {
      edit: 'Edit',
      cancelActivity: 'Cancel Activity',
      cancelSignup: 'Cancel Signup',
      removeMember: 'Remove',
      delete: 'Delete'
    },
    teamList: {
      empty: 'No players yet'
    }
  },
  activityCreate: {
    title: 'Activity title',
    activityDate: 'Activity date',
    activityTime: 'Activity time',
    startTime: 'Start time',
    endTime: 'End time',
    signupDeadline: 'Signup deadline',
    deadlineDate: 'Deadline date',
    deadlineTime: 'Deadline time',
    deadlineHint: 'Signup deadline must be earlier than or equal to the activity start time.',
    inviteCode: 'Invite code',
    inviteCodePlaceholder: 'Optional invite code',
    teams: 'Teams',
    teamsHint: 'Default to two teams. You can add Team 3 and Team 4 if needed.',
    totalSignupLimit: 'Total signup limit',
    totalSignupLimitPlaceholder: 'Total signup limit',
    namedTeamsSlots: 'Named teams: {{count}} slots',
    benchSlots: 'Bench: {{count}} slots',
    overCapacity: 'Total signup limit must cover all named team slots.',
    requirePhone: 'Require phone',
    description: 'Description',
    descriptionPlaceholder: 'Description',
    activityImage: 'Activity image',
    imageHint:
      'Currently supports {{count}} image. It will be cropped to the shared 2:1 cover frame used on Home and Activity Detail. The data model already reserves imageList for future multi-image support.',
    replaceImage: 'Replace image',
    chooseAndCropImage: 'Choose and crop image',
    removeImage: 'Remove image',
    permissionChecking: 'Checking create permission...',
    noCreatePermissionTitle: 'Create permission required',
    noCreatePermissionHint: 'Ask an admin to add the organizer role to your user before creating activities.',
    location: 'Location',
    addressPlaceholder: 'Address',
    selectedPin: 'Selected pin: {{name}}',
    chooseOnMap: 'Choose on WeChat Map',
    publish: 'Publish Activity',
    saveChanges: 'Save Changes'
  },
  activityJoin: {
    title: 'Join {{teamName}}',
    hint: 'Use WeChat details when available, or enter them manually.',
    avatar: 'Avatar',
    avatarPlaceholder: 'Avatar',
    avatarHint: 'Optional. Tap to use or change your WeChat avatar.',
    signupName: 'Signup name',
    signupNamePlaceholder: 'Signup name',
    phone: 'Phone',
    phonePlaceholder: 'Phone',
    useWeChatPhone: 'Use WeChat',
    phoneHint: 'Phone is required. You can authorize WeChat phone or type it manually.',
    phoneAuthSkipped: 'Phone authorization skipped',
    phoneAuthFailed: 'Unable to get WeChat phone',
    confirm: 'Confirm',
    success: 'Signup successful'
  },
  coverCrop: {
    title: 'Adjust Cover',
    hint: 'The full image stays visible below. The highlighted 2:1 frame is the final cover that will be shown on Home and Activity Detail.',
    loading: 'Preparing cropper...',
    controls: {
      zoom: 'Zoom',
      panX: 'Horizontal framing',
      panY: 'Vertical framing'
    },
    actions: {
      confirm: 'Use Cover',
      cancel: 'Cancel'
    }
  },
  my: {
    filterLabel: 'Filter',
    tabs: {
      created: 'Created',
      joined: 'Joined'
    },
    filters: {
      all: 'All',
      published: 'Active',
      cancelled: 'Cancelled',
      deleted: 'Deleted'
    },
    languageLabel: 'Language',
    userIdLabel: 'User ID',
    copyUserId: 'Copy ID',
    copyUserIdSuccess: 'User ID copied',
    roleLabel: 'Roles:'
  },
  teamEditor: {
    addTeam: 'Add Team',
    remove: 'Remove',
    upToTeams: 'Up to {{count}} teams',
    teamNamePrefix: 'Team',
    whiteTeam: 'White',
    redTeam: 'Red'
  },
  modal: {
    cancelActivity: {
      title: 'Cancel Activity',
      content: 'This will stop new signups and mark the activity as cancelled.'
    },
    deleteActivity: {
      title: 'Delete Activity',
      content: 'Only empty activities can be deleted. Deleted activities stay in your history.'
    },
    removeRegistration: {
      title: 'Remove member',
      content: 'Remove {{name}} from this activity?',
      defaultName: 'this member'
    }
  },
  toast: {
    chooseLocationFailed: 'Unable to choose location',
    chooseImageFailed: 'Unable to choose image',
    openImageFailed: 'Unable to open image',
    cropImageFailed: 'Unable to crop image',
    loadImageSourceFailed: 'Unable to load image source.',
    loadActivitiesFailed: 'Unable to load activities',
    locationPinUnavailable: 'Location pin not available'
  },
  errors: {
    activityTitleRequired: 'Activity title is required',
    activityAddressRequired: 'Activity address is required',
    activityStartTimeRequired: 'Activity start time is required',
    activityEndTimeRequired: 'Activity end time is required',
    signupDeadlineRequired: 'Signup deadline is required',
    activityEndTimeOrder: 'Activity end time must be later than start time',
    signupDeadlineOrder: 'Signup deadline must be earlier than or equal to activity start time',
    totalSignupLimitRequired: 'Total signup limit is required',
    onlyOneActivityImage: 'Only one activity image is supported right now',
    atLeastOneTeamRequired: 'At least one team is required',
    tooManyTeams: 'Too many teams',
    teamNameRequired: 'Team name is required',
    teamCapacityRequired: 'Team capacity must be greater than 0',
    totalSignupLimitCoverTeams: 'Total signup limit must cover all team slots',
    signupNameRequired: 'Signup name is required',
    phoneRequired: 'Phone is required',
    activityNotFound: 'Activity not found',
    activityNotOpen: 'Activity is not open for signup',
    signupClosed: 'Signup is closed',
    teamNotFound: 'Team not found',
    activityFull: 'Activity is full',
    teamFull: 'Team is full',
    alreadyJoined: 'You already joined this activity',
    noActiveRegistration: 'No active registration to cancel',
    signupCannotBeCancelled: 'Signup can no longer be cancelled',
    removeRegistrationNotAllowed: 'Only the organizer or an admin can remove registrations',
    organizerCancelOnly: 'Only the organizer can cancel this activity',
    organizerDeleteOnly: 'Only the organizer can delete this activity',
    deleteOnlyEmpty: 'Only activities without joined players can be deleted',
    createActivityNotAllowed: 'Only organizers can create activities',
    editActivityNotAllowed: 'Only the organizer or an admin can edit this activity',
    createPermissionCheckFailed: 'Unable to check create permission'
  }
};
