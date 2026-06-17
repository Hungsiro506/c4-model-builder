workspace "Axon" "DataStore deployment change document" {

  model {
    dse = person "DSE" "Deployment approver" "existing"
    baAgency = person "BA's Agency" "Requests deployments" "existing"

    edca = softwareSystem "EDCA" "Admin Configuration Portal" "existing" {
      web = container "Web Application" "Serving SWSS Approver and Contributor" "ReactJS" "existing"
      hermes = container "Hermes" "The RMS Gateway" "TypeScript" "existing"
    }

    rms = softwareSystem "RMS" "Records Management System" "existing" {
      configsvc = container "ConfigSvc" "Stores Agency's config" "Go" "existing"
    }

    dataStore = softwareSystem "DataStore" "Analytics data store" "existing" {
      deploymentWorker = container "Deployment Worker" "Lazy deployment worker" "Go" "new" {
        dwApi = component "ADAT API" "Manage deployment request" "Go" "new"
        dwScheduler = component "Poller" "Polls approved deployment requests" "Go" "new"
      }
      eventConductor = container "Event-Conductor" "DataStore ETL pipeline" "Go" "existing"
      skemataDb = container "Skemata DB" "DataStore centralize DB" "MySQL" "existing"
    }

    infraProvisioning = softwareSystem "Infra Provisioning" "Infrastructure provisioning" "existing" {
      alsInfra = container "als-infra" "Infrastructure provisioning" "Terraform" "existing"
    }

    # Finest-level relationships (system-level edges are derived by re-targeting).
    dse -> web "Approve / Reject Deployment Request" "" "updated"
    baAgency -> web "Create Deployment Request" "" "updated"
    web -> hermes "Requests DataStore deployment" "" "new"
    hermes -> configsvc "Forwards deployment requests" "" "new"
    hermes -> deploymentWorker "Forwards deployment requests" "" "new"
    deploymentWorker -> configsvc "Add new agency config" "" "new"
    deploymentWorker -> skemataDb "Deploy DataStore" "" "new"
    eventConductor -> configsvc "Get agency config" "" "existing"
    alsInfra -> skemataDb "Provision AzureSQL" "" "updated"
  }

  views {
    systemLandscape "Landscape" "Axon system landscape" {
      include *
      autoLayout
    }

    styles {
      element "existing" {
        background #6b7280
        color #ffffff
      }
      element "new" {
        background #1f6feb
        color #ffffff
      }
      relationship "existing" {
        color #000000
      }
      relationship "new" {
        color #1f6feb
      }
      relationship "updated" {
        color #22c55e
      }
    }
  }
}
