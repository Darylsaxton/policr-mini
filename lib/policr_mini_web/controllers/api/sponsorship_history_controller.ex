defmodule PolicrMiniWeb.API.SponsorshipHistoryController do
  @moduledoc """
  赞助历史的前台 API 控制器。
  """

  use PolicrMiniWeb, :controller

  alias PolicrMini.{SponsorBusiness, SponsorshipHistoryBusiness}

  action_fallback(PolicrMiniWeb.API.FallbackController)

  @hints_map %{
    "@1" => {"给作者买单一份外卖", 25},
    "@2" => {"为服务器续费一个月", 55},
    "@3" => {"承担下个月的运营成本", 99},
    "@4" => {"项目功能的进一步完善", 150},
    "@5" => {"此星期内作者能为项目付出更多的时间", 199},
    "@6" => {"让作者帮忙解决一些小的技术问题", 299},
    "@7" => {"让作者帮忙解决一些技术难题", 599},
    "@8" => {"让作者承接自己的项目", 999},
    "@9" => {"宣传或展示企业、产品自身", 1999}
  }
  @hints Enum.map(@hints_map, fn {ref, {expected_to, amount}} ->
           %{ref: ref, expected_to: expected_to, amount: amount}
         end)

  @order_by [desc: :reached_at]
  def index(conn, _params) do
    sponsorship_histories =
      SponsorshipHistoryBusiness.find_list(
        has_reached: true,
        preload: [:sponsor],
        order_by: @order_by
      )

    render(conn, "index.json", %{
      sponsorship_histories: sponsorship_histories,
      hints: @hints
    })
  end

  def add(conn, %{"uuid" => uuid} = params) when uuid != nil do
    with {:ok, sponsor} <- find_sponsor_by_uuid(uuid),
         {:ok, params} <- preprocessing_params(Map.put(params, "sponsor_id", sponsor.id)),
         {:ok, sponsorship_history} <- SponsorshipHistoryBusiness.create(params) do
      render(conn, "sponsorship_history.json", %{sponsorship_history: sponsorship_history})
    end
  end

  def add(conn, params) do
    with {:ok, params} <- preprocessing_params(params),
         {:ok, sponsorship_history} <-
           SponsorshipHistoryBusiness.create_with_sponsor(params) do
      render(conn, "sponsorship_history.json", %{sponsorship_history: sponsorship_history})
    end
  end

  defp find_sponsor_by_uuid(uuid) do
    case SponsorBusiness.find(uuid: uuid) do
      nil -> {:error, %{description: "没有找到此 UUID 关联的赞助者"}}
      sponsor -> {:ok, sponsor}
    end
  end

  defp preprocessing_params(%{"expected_to" => ref} = params) do
    if hint = @hints_map[ref] do
      expected_to = elem(hint, 0)

      params =
        params
        |> Map.put("expected_to", expected_to)
        |> Map.put("has_reached", false)

      {:ok, params}
    else
      {:error, %{description: "预期用途的引用值 `#{ref}` 是无效的"}}
    end
  end
end
