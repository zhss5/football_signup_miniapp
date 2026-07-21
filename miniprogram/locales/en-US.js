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
    copyActivity: 'Copy Activity',
    activityDetail: 'Activity Detail',
    myActivities: 'My Activities',
    adjustCover: 'Adjust Cover',
    joinActivity: 'Join Activity'
  },
  home: {
    createActivity: 'Create Activity',
    emptyTitle: 'No activities scheduled',
    emptyCopy: 'New joinable activities will appear here.',
    loadMore: 'Load more',
    loadingMore: 'Loading...'
  },
  teamColors: {
    green: 'Green',
    white: 'White',
    red: 'Red',
    blue: 'Blue',
    black: 'Black',
    yellow: 'Yellow',
    orange: 'Orange',
    purple: 'Purple',
    gray: 'Gray',
    pink: 'Pink'
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
      expired: 'Expired',
      joined: 'Joined',
      confirmed: 'Confirmed'
    },
    share: {
      publishedTitle: 'Activity published',
      publishedCopy: 'Invite players right away from the activity detail page.',
      defaultTitle: 'Share this activity',
      defaultCopy: 'Use WeChat share to send this signup page to your group.',
      action: 'Share Activity'
    },
    insurance: {
      title: 'Insurance',
      copyHint: 'Copy the insurance link and open it in WeChat or a browser.',
      copyAction: 'Insurance purchase link \ud83d\udd17'
    },
    descriptionTitle: 'Description',
    timeLabel: 'Activity time',
    activityImagesTitle: 'Activity images',
    managerActionsTitle: 'Manager actions',
    actions: {
      edit: 'Edit',
      join: 'Join',
      copyParticipantNames: 'Copy participant names',
      copyActivity: 'Copy Activity',
      subscribeRegistrationNotifications: 'Subscribe signup notices',
      registrationNotificationsSubscribed: 'Signup notices subscribed',
      proxySignup: 'Add participant',
      confirmProceeding: 'Confirm Activity',
      cancelActivity: 'Cancel Activity',
      cancelSignup: 'Cancel Signup',
      markPresent: 'Mark present',
      markAbsent: 'Mark absent',
      managerAlias: 'Alias',
      moveMember: 'Move',
      removeMember: 'Remove',
      delete: 'Delete'
    },
    teamList: {
      empty: 'No players yet'
    },
    teamColorTitle: 'Team color',
    member: {
      proxySignup: 'Proxy'
    },
    attendance: {
      title: 'Attendance',
      present: 'Present',
      absent: 'Absent'
    },
    moveTarget: {
      label: '{{teamName}} ({{joined}} / {{total}})'
    }
  },
  activityCreate: {
    title: 'Activity title',
    basicInfoSection: 'Basic info',
    scheduleSection: 'Schedule',
    teamsSection: 'Teams and capacity',
    displaySection: 'Content',
    activityType: 'Activity type',
    activityTypes: {
      internal: 'Internal',
      external: 'External'
    },
    activityDate: 'Activity date',
    activityTime: 'Activity time',
    copyTimeReviewHint: 'Choose the new activity time before publishing.',
    startTime: 'Start time',
    endTime: 'End time',
    signupDeadline: 'Signup deadline',
    deadlineDate: 'Deadline date',
    deadlineTime: 'Deadline time',
    deadlineHint: 'Signup deadline must be earlier than or equal to the activity start time.',
    inviteCode: 'Invite code',
    inviteCodePlaceholder: 'Optional invite code',
    insuranceLink: 'Insurance link',
    insuranceLinkPlaceholder: 'Optional insurance signup link',
    notificationSettings: 'Notification settings',
    notificationSettingsHint: 'Only used for notification messages. It is not shown on the activity detail page.',
    notificationHint: 'Activity proceeding notice reminder',
    notificationHintPlaceholder: 'Optional reminder for activity proceeding notices',
    notificationHintHint: 'Up to 20 characters. Line breaks and tabs are converted to spaces.',
    teams: 'Teams',
    teamsHint: 'Default to one team. Add more teams if needed.',
    benchCapacity: 'Bench capacity',
    benchCapacityPlaceholder: 'Bench capacity',
    benchCapacityHint: 'Use 0 when no bench queue is needed.',
    totalSignupLimit: 'Total signup limit',
    totalSignupLimitPlaceholder: 'Total signup limit',
    totalSignupLimitHint: 'Calculated from regular team capacity plus bench capacity.',
    registrationNoticeThreshold: 'Signup notice threshold',
    registrationNoticeThresholdPlaceholder: 'Signup notice threshold',
    registrationNoticeThresholdHint: 'Default is 80% of the total signup limit. A notice is sent only when a regular signup reaches this number.',
    namedTeamsSlots: 'Named teams: {{count}} slots',
    benchSlots: 'Bench: {{count}} slots',
    overCapacity: 'Total signup limit must cover all named team slots.',
    description: 'Description',
    descriptionPlaceholder: 'Description',
    coverImage: 'Cover image',
    detailImages: 'Detail images',
    detailImageHint: 'Upload up to {{count}} extra images for the activity detail page.',
    addDetailImages: 'Add detail images',
    activityImage: 'Activity image',
    imageHint:
      'Currently supports {{count}} image. It will be cropped to the shared 5:4 cover frame used on Home, Activity Detail, and WeChat shares. The data model already reserves imageList for future multi-image support.',
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
    preferredPositions: 'Preferred positions',
    preferredPositionsHint: 'Optional. Choose up to 2 positions.',
    preferredPositionsLimit: 'Choose up to 2 positions',
    confirm: 'Confirm',
    success: 'Signup successful'
  },
  coverCrop: {
    title: 'Adjust Cover',
    hint: 'The full image stays visible below. The highlighted 5:4 frame is the final cover used on Home, Activity Detail, and WeChat shares.',
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
    roleLabel: 'Roles:',
    webAdminLoginTitle: 'Web Admin',
    webAdminLoginHint: 'Scan a web admin login code with your WeChat identity.',
    webAdminLoginAction: 'Scan login code',
    webAdminToolbarAction: 'Web admin scan',
    webAdminLoginConfirmTitle: 'Confirm web admin login',
    webAdminLoginConfirmContent: 'Allow this browser to sign in as your admin account?',
    loadMore: 'Load more',
    loadingMore: 'Loading...'
  },
  teamEditor: {
    addTeam: 'Add Team',
    remove: 'Remove',
    upToTeams: 'Up to {{count}} teams',
    teamNamePrefix: 'Team ',
    colorPaletteTitle: 'Team color',
    whiteTeam: 'White',
    redTeam: 'Red'
  },
  modal: {
    cancelActivity: {
      title: 'Cancel Activity',
      content: 'This will stop new signups and notify subscribed participants.'
    },
    cancelSignup: {
      title: 'Cancel Signup',
      content: 'Leave this activity?'
    },
    confirmProceeding: {
      title: 'Confirm Activity',
      content: 'Mark this activity as confirmed and notify subscribed participants?'
    },
    deleteActivity: {
      title: 'Delete Activity',
      content: 'Only empty activities can be deleted. Deleted activities stay in your history.'
    },
    removeRegistration: {
      title: 'Remove member',
      content: 'Remove {{name}} from this activity?',
      defaultName: 'this member'
    },
    managerAlias: {
      title: 'Manager alias',
      content: 'Set a manager-only alias for {{name}}.',
      placeholder: 'Alias visible to managers',
      defaultName: 'this member'
    },
    participant: {
      title: 'Participant',
      aliasLabel: 'Remark',
      close: 'Close',
      cancel: 'Cancel',
      save: 'Save'
    },
    proxySignup: {
      title: 'Add participant',
      placeholder: 'Participant name',
      cancel: 'Cancel'
    }
  },
  toast: {
    chooseLocationFailed: 'Unable to choose location',
    chooseImageFailed: 'Unable to choose image',
    openImageFailed: 'Unable to open image',
    cropImageFailed: 'Unable to crop image',
    loadImageSourceFailed: 'Unable to load image source.',
    loadActivitiesFailed: 'Unable to load activities',
    locationPinUnavailable: 'Location pin not available',
    participantNamesCopied: 'Participant names copied',
    insuranceLinkCopied: 'Insurance link copied',
    noParticipantsToCopy: 'No participants to copy',
    proxySignupSuccess: 'Participant added',
    proxySignupAutoAssigned: 'Participant added to {{teamName}}',
    moveRegistrationSuccess: 'Participant moved',
    noMoveTargetTeam: 'No available target team',
    activityConfirmed: 'Activity confirmed',
    attendanceUpdated: 'Attendance updated',
    managerAliasUpdated: 'Alias updated',
    participantSaved: 'Saved',
    notificationFailed: 'Notification failed',
    registrationNotificationSubscribed: 'Signup notifications enabled',
    registrationNotificationNotEnabled: 'Signup notifications not enabled',
    webAdminLoginConfirmed: 'Web admin login confirmed',
    webAdminLoginScanUnavailable: 'Scan is unavailable',
    webAdminLoginInvalidQr: 'Invalid login code'
  },
  errors: {
    activityTitleRequired: 'Activity title is required',
    activityAddressRequired: 'Activity address is required',
    activityStartTimeRequired: 'Activity start time is required',
    activityEndTimeRequired: 'Activity end time is required',
    signupDeadlineRequired: 'Signup deadline is required',
    activityEndTimeOrder: 'Activity end time must be later than start time',
    signupDeadlineOrder: 'Signup deadline must be earlier than or equal to activity start time',
    activityDescriptionTooLong: 'Activity description supports up to 2000 characters',
    invalidActivityType: 'Invalid activity type',
    benchCapacityInvalid: 'Bench capacity must be a non-negative integer',
    totalSignupLimitRequired: 'Total signup limit is required',
    registrationNoticeThresholdRange: 'Registration notice threshold must be between 1 and total signup limit',
    onlyOneActivityImage: 'Only one activity image is supported right now',
    tooManyDetailImages: 'Up to five detail images are supported',
    atLeastOneTeamRequired: 'At least one team is required',
    tooManyTeams: 'Too many teams',
    teamNameRequired: 'Team name is required',
    teamCapacityRequired: 'Team capacity must be greater than 0',
    joinedTeamCannotBeRemoved: 'Teams with joined members cannot be removed',
    teamCapacityBelowJoined: 'Team capacity cannot be lower than joined members',
    totalSignupLimitCoverTeams: 'Total signup limit must cover all team slots',
    signupNameRequired: 'Signup name is required',
    activityNotFound: 'Activity not found',
    activityNotOpen: 'Activity is not open for signup',
    signupClosed: 'Signup is closed',
    teamNotFound: 'Team not found',
    activityFull: 'Activity is full',
    teamFull: 'Team is full',
    alreadyJoined: 'You already joined this activity',
    contactOrganizer: 'Please contact the organizer',
    repeatSignupLimitExceeded: 'Too many repeat signups. Please contact the organizer',
    noActiveRegistration: 'No active registration to cancel',
    signupCannotBeCancelled: 'Signup can no longer be cancelled',
    removeRegistrationNotAllowed: 'Only the organizer or an admin can remove registrations',
    proxySignupNotAllowed: 'Only the organizer or an admin can add participants',
    moveRegistrationNotAllowed: 'Only the organizer or an admin can move registrations',
    noActiveRegistrationToMove: 'No active registration to move',
    activityRosterClosed: 'Activity is not open for roster changes',
    alreadyInTargetTeam: 'Already in target team',
    benchQueueManagedAutomatically: 'Bench registrations are managed automatically',
    organizerCancelOnly: 'Only the organizer or an admin can cancel this activity',
    organizerDeleteOnly: 'Only the organizer can delete this activity',
    deleteOnlyEmpty: 'Only activities without joined players can be deleted',
    createActivityNotAllowed: 'Only organizers can create activities',
    editActivityNotAllowed: 'Only the organizer or an admin can edit this activity',
    copyActivityNotAllowed: 'Only the organizer or an admin can copy this activity',
    deletedActivityCannotBeCopied: 'Deleted activities cannot be copied',
    copyActivityTimeRequired: 'Review activity time before publishing',
    createPermissionCheckFailed: 'Unable to check create permission'
  }
};

module.exports.activity.status.pending = 'Pending';
